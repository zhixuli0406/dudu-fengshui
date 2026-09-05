import * as THREE from 'three'

/**
 * WebXR AR room-corner capture using hit-test (Chrome Android, Samsung Internet, Quest, visionOS Safari).
 * The user taps the screen to place a marker at the reticle; markers are joined into a floor polygon.
 * Returned coordinates are metres in the XR reference space (x right, z towards the viewer at session start).
 */
export interface ARPoint { x: number; z: number; y: number }

export interface ARSessionHandle {
  session: XRSession
  end: () => Promise<void>
  undo: () => void
  points: () => ARPoint[]
  /** Chrome 147+: ask the OS to capture the room (plane-detection). Resolves false if unsupported. */
  roomCapture: () => Promise<boolean>
  /** Largest detected horizontal floor plane polygon (metres), if plane-detection is available. */
  floorOutline: () => ARPoint[] | null
}

export interface ARCallbacks {
  onPoints: (pts: ARPoint[]) => void
  onStatus: (msg: string) => void
  onEnd: () => void
  /** whether plane-detection feature was granted */
  onFeatures?: (f: { planeDetection: boolean; depth: boolean }) => void
}

export async function isARSupported(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('xr' in navigator) || !navigator.xr) return false
  try { return await navigator.xr.isSessionSupported('immersive-ar') } catch { return false }
}

export async function startARSession(overlayRoot: HTMLElement, cb: ARCallbacks): Promise<ARSessionHandle> {
  const xr = navigator.xr!
  const session = await xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test', 'local-floor'],
    optionalFeatures: ['dom-overlay', 'plane-detection', 'depth-sensing', 'anchors'],
    domOverlay: { root: overlayRoot },
    // depth-sensing init (ignored if unsupported)
    ...({ depthSensing: { usagePreference: ['cpu-optimized'], dataFormatPreference: ['luminance-alpha'] } } as object),
  } as XRSessionInit)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.xr.enabled = true
  renderer.xr.setReferenceSpaceType('local-floor')
  renderer.domElement.style.position = 'fixed'
  renderer.domElement.style.inset = '0'
  document.body.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2))

  // reticle
  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.08, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd6b35c }))
  reticle.matrixAutoUpdate = false
  reticle.visible = false
  scene.add(reticle)

  const markerGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.01, 24)
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xc0392b })
  const markers: THREE.Mesh[] = []
  const pts: ARPoint[] = []
  let lineObj: THREE.Line | null = null
  const lineMat = new THREE.LineBasicMaterial({ color: 0xd6b35c, linewidth: 2 })

  const refreshLine = () => {
    if (lineObj) { scene.remove(lineObj); lineObj.geometry.dispose(); lineObj = null }
    if (pts.length >= 2) {
      const g = new THREE.BufferGeometry().setFromPoints([...pts, pts[0]!].map((p) => new THREE.Vector3(p.x, p.y + 0.005, p.z)))
      lineObj = new THREE.Line(g, lineMat)
      scene.add(lineObj)
    }
    cb.onPoints([...pts])
  }

  await renderer.xr.setSession(session)
  const viewerSpace = await session.requestReferenceSpace('viewer')
  const hitSource = await session.requestHitTestSource?.({ space: viewerSpace })
  const enabled = (session as unknown as { enabledFeatures?: string[] }).enabledFeatures ?? []
  cb.onFeatures?.({ planeDetection: enabled.includes('plane-detection'), depth: enabled.includes('depth-sensing') })
  cb.onStatus(hitSource ? '對準地板轉角，畫面出現金色圓環後點擊放置' : '此裝置不支援 hit-test')

  const onSelect = () => {
    if (!reticle.visible) return
    const m = new THREE.Mesh(markerGeo, markerMat)
    m.position.setFromMatrixPosition(reticle.matrix)
    scene.add(m)
    markers.push(m)
    pts.push({ x: m.position.x, y: m.position.y, z: m.position.z })
    refreshLine()
    cb.onStatus(`已放置 ${pts.length} 個轉角`)
  }
  const controller = renderer.xr.getController(0)
  controller.addEventListener('select', onSelect)
  scene.add(controller)

  // plane detection: draw detected horizontal planes for guidance
  const planeMeshes = new Map<XRPlane, THREE.Mesh>()
  const planeMat = new THREE.MeshBasicMaterial({ color: 0x2e8b6a, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
  let bestFloor: { area: number; pts: ARPoint[] } | null = null
  const tmpV = new THREE.Vector3()
  const tmpM = new THREE.Matrix4()

  renderer.setAnimationLoop((_t, frame?: XRFrame) => {
    if (!frame) return
    const refSpace = renderer.xr.getReferenceSpace()
    if (hitSource && refSpace) {
      const hits = frame.getHitTestResults(hitSource)
      const hit = hits[0]
      const pose = hit?.getPose(refSpace)
      if (pose) { reticle.visible = true; reticle.matrix.fromArray(pose.transform.matrix) } else reticle.visible = false
    }
    const detected = (frame as unknown as { detectedPlanes?: Set<XRPlane> }).detectedPlanes
    if (detected && refSpace) {
      for (const [plane, mesh] of planeMeshes) if (!detected.has(plane)) { scene.remove(mesh); planeMeshes.delete(plane) }
      for (const plane of detected) {
        if (plane.orientation !== 'horizontal') continue
        const pose = frame.getPose(plane.planeSpace, refSpace)
        if (!pose) continue
        let mesh = planeMeshes.get(plane)
        if (!mesh) {
          const shape = new THREE.Shape(plane.polygon.map((p) => new THREE.Vector2(p.x, p.z)))
          const geo = new THREE.ShapeGeometry(shape)
          geo.rotateX(Math.PI / 2)
          mesh = new THREE.Mesh(geo, planeMat)
          mesh.matrixAutoUpdate = false
          scene.add(mesh)
          planeMeshes.set(plane, mesh)
        }
        mesh.matrix.fromArray(pose.transform.matrix)
        // track the largest horizontal plane as the floor candidate (world coordinates)
        tmpM.fromArray(pose.transform.matrix)
        const world = plane.polygon.map((p) => { tmpV.set(p.x, p.y, p.z).applyMatrix4(tmpM); return { x: tmpV.x, y: tmpV.y, z: tmpV.z } })
        let a = 0
        for (let i = 0; i < world.length; i++) { const p = world[i]!, q = world[(i + 1) % world.length]!; a += p.x * q.z - q.x * p.z }
        a = Math.abs(a) / 2
        if (!bestFloor || a > bestFloor.area) bestFloor = { area: a, pts: world }
      }
    }
    renderer.render(scene, camera)
  })

  const cleanup = () => {
    renderer.setAnimationLoop(null)
    controller.removeEventListener('select', onSelect)
    renderer.dispose()
    renderer.domElement.remove()
    cb.onEnd()
  }
  session.addEventListener('end', cleanup)

  return {
    session,
    end: async () => { try { await session.end() } catch { cleanup() } },
    undo: () => { const m = markers.pop(); if (m) scene.remove(m); pts.pop(); refreshLine() },
    points: () => [...pts],
    roomCapture: async () => {
      const s = session as unknown as { initiateRoomCapture?: () => Promise<void> }
      if (typeof s.initiateRoomCapture !== 'function') return false
      try { await s.initiateRoomCapture(); cb.onStatus('房間掃描完成，可按「用偵測到的地板」'); return true } catch (e) { cb.onStatus(`房間掃描失敗：${(e as Error).message}`); return false }
    },
    floorOutline: () => (bestFloor && bestFloor.pts.length >= 3 ? bestFloor.pts.map((p) => ({ ...p })) : null),
  }
}

/** Convert AR floor points (metres, XR space) into plan coordinates (cm, y-down). */
export function arPointsToPlan(pts: ARPoint[]): { x: number; y: number }[] {
  // XR: +x right, −z forward (away from user at session start). Plan: +x right, −y up (= forward).
  return pts.map((p) => ({ x: Math.round(p.x * 100), y: Math.round(p.z * 100) }))
}
