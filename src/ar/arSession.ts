import * as THREE from 'three'
import type { ItemType } from '../engine/floorplan'
import { ITEM_ZH } from '../engine/floorplan'

/**
 * WebXR AR room capture (hit-test based). Works on Chrome Android / Samsung Internet / Quest / visionOS,
 * and on iOS through the Variant Launch viewer (hit-test + anchors + DOM overlay, no plane-detection).
 *
 * Capture is staged: outline (外牆) → rooms (each a polygon) → openings (door / window points on walls).
 * Coordinates are metres in the XR reference space (x right, −z forward at session start, y up).
 */
export interface ARPoint { x: number; y: number; z: number }
export type CaptureStage = 'outline' | 'room' | 'opening' | 'item'
export type OpeningKind = 'mainDoor' | 'door' | 'window'
export interface CapturedPolygon { stage: 'outline' | 'room'; pts: ARPoint[]; label?: string }
export interface CapturedOpening { kind: OpeningKind; p: ARPoint }
/** A piece of furniture tapped on the floor; `yaw` is the camera heading in XR space (0 = −z, clockwise) when placed. */
export interface CapturedItem { type: ItemType; p: ARPoint; yaw?: number }
export interface WallSegment { a: ARPoint; b: ARPoint }

export interface ARSessionHandle {
  session: XRSession
  end: () => Promise<void>
  /** remove the last point of the polygon in progress (or last opening / item in those stages) */
  undo: () => void
  points: () => ARPoint[]
  polygons: () => CapturedPolygon[]
  openings: () => CapturedOpening[]
  items: () => CapturedItem[]
  /** compass bearing the XR forward axis points to, averaged over the session; null if the compass never reported */
  northOffset: () => number | null
  stage: () => CaptureStage
  setStage: (s: CaptureStage, opts?: { label?: string; openingKind?: OpeningKind; itemType?: ItemType }) => void
  /** commit the polygon in progress (needs ≥ 3 points) */
  closePolygon: () => boolean
  /** Chrome 147+: ARCore room capture flow (plane-detection). false if unsupported. */
  roomCapture: () => Promise<boolean>
  /** largest detected horizontal plane, world coords */
  floorOutline: () => ARPoint[] | null
  /** wall lines from detected vertical planes, projected to the floor */
  wallSegments: () => WallSegment[]
  /** use the detected floor polygon as the polygon in progress */
  useDetectedFloor: () => boolean
}

export interface ARCallbacks {
  onChange: (state: { stage: CaptureStage; points: ARPoint[]; polygons: CapturedPolygon[]; openings: CapturedOpening[]; items: CapturedItem[]; walls: WallSegment[]; reticle: ARPoint | null }) => void
  onStatus: (msg: string) => void
  /** latest compass heading of the camera (degrees); sampled against the XR camera yaw to find north */
  getHeading?: () => number | null
  onTracking?: (hint: string | null) => void
  onFeatures?: (f: { planeDetection: boolean; depth: boolean; localFloor: boolean }) => void
  onEnd: () => void
}

export async function isARSupported(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('xr' in navigator) || !navigator.xr) return false
  try { return await navigator.xr.isSessionSupported('immersive-ar') } catch { return false }
}

const TRACKING_HINT: Record<string, string | null> = {
  normal: null,
  'not-available': '追蹤尚未啟動，請緩慢移動手機',
  'limited-initializing': '初始化中，請緩慢左右移動手機',
  'limited-excessive-motion': '移動太快，請放慢',
  'limited-insufficient-features': '地面特徵不足，請對準有紋理的地板、踢腳線或家具邊緣',
  'limited-relocalizing': '重新定位中，請回到剛才掃描過的位置',
}

export async function startARSession(overlayRoot: HTMLElement, cb: ARCallbacks): Promise<ARSessionHandle> {
  const xr = navigator.xr!
  const session = await xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['local-floor', 'local', 'dom-overlay', 'plane-detection', 'anchors'],
    domOverlay: { root: overlayRoot },
  } as XRSessionInit)

  // Taps on overlay UI must not place points.
  const swallowSelect = (e: Event) => e.preventDefault()
  overlayRoot.addEventListener('beforexrselect', swallowSelect)
  document.documentElement.classList.add('ar-active')
  const onTracking = (e: Event) => {
    const state = (e as CustomEvent<{ state?: string }>).detail?.state ?? ''
    cb.onTracking?.(TRACKING_HINT[state] ?? (state ? `追蹤狀態：${state}` : null))
  }
  document.addEventListener('vlaunch-ar-tracking', onTracking)

  const enabled = (session as unknown as { enabledFeatures?: string[] }).enabledFeatures ?? []
  const localFloor = enabled.includes('local-floor') || enabled.length === 0

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.xr.enabled = true
  renderer.xr.setReferenceSpaceType(localFloor ? 'local-floor' : 'local')
  renderer.domElement.style.position = 'fixed'
  renderer.domElement.style.inset = '0'
  document.body.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2))

  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.08, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2e9a76 }))
  reticle.matrixAutoUpdate = false
  reticle.visible = false
  scene.add(reticle)

  // ---- capture state
  let stage: CaptureStage = 'outline'
  let roomLabel: string | undefined
  let openingKind: OpeningKind = 'door'
  let itemType: ItemType = 'bed'
  const cur: ARPoint[] = []
  const polygons: CapturedPolygon[] = []
  const openings: CapturedOpening[] = []
  const items: CapturedItem[] = []
  const markers: THREE.Object3D[] = []
  const committed = new THREE.Group()
  scene.add(committed)
  let line: THREE.Line | null = null
  let lastReticle: ARPoint | null = null

  const mat = { outline: new THREE.MeshBasicMaterial({ color: 0x2e9a76 }), room: new THREE.MeshBasicMaterial({ color: 0x3b82f6 }), opening: new THREE.MeshBasicMaterial({ color: 0xf59e0b }), item: new THREE.MeshBasicMaterial({ color: 0xa855f7 }) }
  const markerGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.01, 24)
  const lineMat = { outline: new THREE.LineBasicMaterial({ color: 0x2e9a76 }), room: new THREE.LineBasicMaterial({ color: 0x3b82f6 }) }
  const isPolygonStage = (s: CaptureStage): s is 'outline' | 'room' => s === 'outline' || s === 'room'

  // ---- north: compare the compass (camera heading) with the XR camera yaw whenever both are known
  const northSamples: { x: number; y: number }[] = []
  const fwd = new THREE.Vector3()
  const cameraYaw = () => {
    fwd.set(0, 0, -1).transformDirection(renderer.xr.getCamera().matrixWorld)
    return ((Math.atan2(fwd.x, -fwd.z) * 180) / Math.PI + 360) % 360
  }
  const northOffset = () => {
    if (!northSamples.length) return null
    const s = northSamples.reduce((a, v) => ({ x: a.x + v.x, y: a.y + v.y }), { x: 0, y: 0 })
    return ((Math.atan2(s.y, s.x) * 180) / Math.PI + 360) % 360
  }
  let lastNorth = 0

  const emit = () => cb.onChange({ stage, points: [...cur], polygons: polygons.map((p) => ({ ...p, pts: [...p.pts] })), openings: [...openings], items: [...items], walls: wallSegments(), reticle: lastReticle })
  const refreshLine = () => {
    if (line) { scene.remove(line); line.geometry.dispose(); line = null }
    if (cur.length >= 2 && isPolygonStage(stage)) {
      const g = new THREE.BufferGeometry().setFromPoints(cur.map((p) => new THREE.Vector3(p.x, p.y + 0.005, p.z)))
      line = new THREE.Line(g, lineMat[stage])
      scene.add(line)
    }
  }
  const addMarker = (p: ARPoint, kind: 'outline' | 'room' | 'opening' | 'item', into: THREE.Object3D = scene) => {
    const m = new THREE.Mesh(markerGeo, mat[kind])
    m.position.set(p.x, p.y, p.z)
    into.add(m)
    return m
  }

  await renderer.xr.setSession(session)
  const viewerSpace = await session.requestReferenceSpace('viewer')
  const hitSource = await session.requestHitTestSource?.({ space: viewerSpace })
  cb.onFeatures?.({ planeDetection: enabled.includes('plane-detection'), depth: enabled.includes('depth-sensing'), localFloor })
  cb.onStatus(hitSource ? '對準地板轉角，出現綠色圓環後點一下放置' : '此裝置不支援 hit-test')

  const onSelect = () => {
    if (!reticle.visible) { cb.onStatus('還沒偵測到地板，請對準地面'); return }
    const p = new THREE.Vector3().setFromMatrixPosition(reticle.matrix)
    const pt = { x: p.x, y: p.y, z: p.z }
    if (stage === 'opening') {
      openings.push({ kind: openingKind, p: pt })
      markers.push(addMarker(pt, 'opening', committed))
      cb.onStatus(`已放置${{ mainDoor: '大門', door: '房門', window: '窗' }[openingKind]}，共 ${openings.length} 個`)
    } else if (stage === 'item') {
      items.push({ type: itemType, p: pt, yaw: cameraYaw() })
      markers.push(addMarker(pt, 'item', committed))
      cb.onStatus(`已放置${ITEM_ZH[itemType]}，共 ${items.length} 件`)
    } else {
      cur.push(pt)
      markers.push(addMarker(pt, stage))
      refreshLine()
      cb.onStatus(cur.length >= 3 ? `已放 ${cur.length} 個轉角，繞完一圈後按「閉合」` : `已放 ${cur.length} 個轉角`)
    }
    emit()
  }
  const controller = renderer.xr.getController(0)
  controller.addEventListener('select', onSelect)
  scene.add(controller)

  // ---- plane detection (Chrome 147+)
  const planeMeshes = new Map<XRPlane, THREE.Mesh>()
  const planeMat = new THREE.MeshBasicMaterial({ color: 0x2e9a76, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
  const wallMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
  let bestFloor: { area: number; pts: ARPoint[] } | null = null
  const walls = new Map<XRPlane, WallSegment>()
  const tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4()
  const wallSegments = () => [...walls.values()]
  let lastEmit = 0

  renderer.setAnimationLoop((t, frame?: XRFrame) => {
    if (!frame) return
    const refSpace = renderer.xr.getReferenceSpace()
    if (hitSource && refSpace) {
      const hit = frame.getHitTestResults(hitSource)[0]
      const pose = hit?.getPose(refSpace)
      if (pose) {
        reticle.visible = true
        reticle.matrix.fromArray(pose.transform.matrix)
        const q = pose.transform.position
        lastReticle = { x: q.x, y: q.y, z: q.z }
      } else { reticle.visible = false; lastReticle = null }
    }
    const detected = (frame as unknown as { detectedPlanes?: Set<XRPlane> }).detectedPlanes
    if (detected && refSpace) {
      for (const [plane, mesh] of planeMeshes) if (!detected.has(plane)) { scene.remove(mesh); planeMeshes.delete(plane); walls.delete(plane) }
      for (const plane of detected) {
        const pose = frame.getPose(plane.planeSpace, refSpace)
        if (!pose) continue
        let mesh = planeMeshes.get(plane)
        if (!mesh) {
          const shape = new THREE.Shape(plane.polygon.map((p) => new THREE.Vector2(p.x, p.z)))
          const geo = new THREE.ShapeGeometry(shape)
          geo.rotateX(Math.PI / 2)
          mesh = new THREE.Mesh(geo, plane.orientation === 'horizontal' ? planeMat : wallMat)
          mesh.matrixAutoUpdate = false
          scene.add(mesh)
          planeMeshes.set(plane, mesh)
        }
        mesh.matrix.fromArray(pose.transform.matrix)
        tmpM.fromArray(pose.transform.matrix)
        const world = plane.polygon.map((p) => { tmpV.set(p.x, p.y, p.z).applyMatrix4(tmpM); return { x: tmpV.x, y: tmpV.y, z: tmpV.z } })
        if (plane.orientation === 'horizontal') {
          let a = 0
          for (let i = 0; i < world.length; i++) { const p = world[i]!, q = world[(i + 1) % world.length]!; a += p.x * q.z - q.x * p.z }
          a = Math.abs(a) / 2
          // prefer low planes (floor), ignore tables
          const y = world.reduce((s, p) => s + p.y, 0) / world.length
          if (y < 0.4 && (!bestFloor || a > bestFloor.area)) bestFloor = { area: a, pts: world }
        } else {
          // vertical plane → floor segment: extreme points along the wall's horizontal direction
          let pa = world[0]!, pb = world[0]!, bd = 0
          for (const p of world) for (const q of world) { const d = (p.x - q.x) ** 2 + (p.z - q.z) ** 2; if (d > bd) { bd = d; pa = p; pb = q } }
          const floorY = bestFloor ? bestFloor.pts.reduce((s, p) => s + p.y, 0) / bestFloor.pts.length : 0
          walls.set(plane, { a: { x: pa.x, y: floorY, z: pa.z }, b: { x: pb.x, y: floorY, z: pb.z } })
        }
      }
    }
    if (t - lastEmit > 120) { lastEmit = t; emit() }
    renderer.render(scene, camera)
    if (t - lastNorth > 400) {
      lastNorth = t
      const h = cb.getHeading?.()
      if (h != null) {
        const off = ((h - cameraYaw()) * Math.PI) / 180
        northSamples.push({ x: Math.cos(off), y: Math.sin(off) })
        if (northSamples.length > 90) northSamples.shift()
      }
    }
  })

  const cleanup = () => {
    document.documentElement.classList.remove('ar-active')
    document.removeEventListener('vlaunch-ar-tracking', onTracking)
    overlayRoot.removeEventListener('beforexrselect', swallowSelect)
    renderer.setAnimationLoop(null)
    controller.removeEventListener('select', onSelect)
    renderer.dispose()
    renderer.domElement.remove()
    cb.onEnd()
  }
  session.addEventListener('end', cleanup)

  const clearCurrent = () => { for (const m of markers) m.parent?.remove(m); markers.length = 0; cur.length = 0; refreshLine() }

  return {
    session,
    end: async () => { try { await session.end() } catch { cleanup() } },
    undo: () => {
      if (stage === 'opening') { openings.pop(); const m = markers.pop(); m?.parent?.remove(m) }
      else if (stage === 'item') { items.pop(); const m = markers.pop(); m?.parent?.remove(m) }
      else { cur.pop(); const m = markers.pop(); m?.parent?.remove(m); refreshLine() }
      emit()
    },
    points: () => [...cur],
    polygons: () => polygons.map((p) => ({ ...p, pts: [...p.pts] })),
    openings: () => [...openings],
    items: () => [...items],
    northOffset,
    stage: () => stage,
    setStage: (s, opts) => { stage = s; roomLabel = opts?.label; if (opts?.openingKind) openingKind = opts.openingKind; if (opts?.itemType) itemType = opts.itemType; clearCurrent(); markers.length = 0; emit() },
    closePolygon: () => {
      if (cur.length < 3 || !isPolygonStage(stage)) return false
      polygons.push({ stage, pts: [...cur], label: roomLabel })
      // keep committed geometry visible
      const g = new THREE.BufferGeometry().setFromPoints([...cur, cur[0]!].map((p) => new THREE.Vector3(p.x, p.y + 0.005, p.z)))
      committed.add(new THREE.Line(g, lineMat[stage]))
      for (const p of cur) addMarker(p, stage, committed)
      clearCurrent()
      cb.onStatus(stage === 'outline' ? '外牆完成。接著新增房間，或直接進入門窗' : `房間${roomLabel ? `「${roomLabel}」` : ''}完成`)
      emit()
      return true
    },
    roomCapture: async () => {
      const s = session as unknown as { initiateRoomCapture?: () => Promise<void> }
      if (typeof s.initiateRoomCapture !== 'function') return false
      try { await s.initiateRoomCapture(); cb.onStatus('房間掃描完成，可按「用偵測到的地板」'); return true } catch (e) { cb.onStatus(`房間掃描失敗：${(e as Error).message}`); return false }
    },
    floorOutline: () => (bestFloor && bestFloor.pts.length >= 3 ? bestFloor.pts.map((p) => ({ ...p })) : null),
    wallSegments,
    useDetectedFloor: () => {
      if (!bestFloor || bestFloor.pts.length < 3 || !isPolygonStage(stage)) return false
      clearCurrent()
      for (const p of simplify(bestFloor.pts, 0.15)) { cur.push({ ...p }); markers.push(addMarker(p, stage)) }
      refreshLine(); emit()
      return true
    },
  }
}

/** Drop near-collinear vertices (metres). */
function simplify(pts: ARPoint[], tol: number): ARPoint[] {
  if (pts.length <= 4) return pts
  const out: ARPoint[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i + pts.length - 1) % pts.length]!, b = pts[i]!, c = pts[(i + 1) % pts.length]!
    const cross = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x))
    const len = Math.hypot(c.x - a.x, c.z - a.z) || 1
    if (cross / len > tol || out.length === 0) out.push(b)
  }
  return out.length >= 3 ? out : pts
}

/** Convert AR points (metres, XR space) to plan cm (y-down, forward = up). */
export function arPointsToPlan(pts: ARPoint[]): { x: number; y: number }[] {
  return pts.map((p) => ({ x: Math.round(p.x * 100), y: Math.round(p.z * 100) }))
}
