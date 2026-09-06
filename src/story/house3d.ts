import * as THREE from 'three'
import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from '../engine/bagua'
import { ITEM_ZH, type FloorPlan, type Item, type Room } from '../engine/floorplan'
import { bbox, polygonCentroid, type Point } from '../engine/geometry'
import type { CameraCue } from './chapters'

/**
 * 3D house built from the floor plan (cm → m). Plan (x, y) with y down maps to world (x, 0, y), so the
 * top-down view matches the 2D plan when the camera looks down with up = −z.
 */
export interface OverlayPalette { [t: string]: string | undefined }

export interface House3D {
  mount: (el: HTMLElement) => void
  dispose: () => void
  /** animate camera to a cue */
  goTo: (cue: CameraCue, opts?: { roomId?: string }) => void
  /** colour palaces on the floor (hex per trigram) and glow some */
  setOverlay: (palette: OverlayPalette, highlight: Trigram[]) => void
  setAutoRotate: (on: boolean) => void
}

const WALL_H = 2.7
const toM = (v: number) => v / 100

const ROOM_COLOR: Record<string, number> = {
  living: 0xd8c39a, master: 0x9fb8dc, bedroom: 0xa9c0de, kids: 0xb8cbe4, study: 0x9fcdb1, kitchen: 0xe0a89a, dining: 0xd9c08f, bathroom: 0xb9c2cc,
  entry: 0xd9cfbf, balcony: 0xb6d3b8, altar: 0xd9a8a0, storage: 0xbdbdbd, corridor: 0xcfcfcf, driveway: 0x8a8a8a, void: 0x6b6b6b, other: 0xc9c9c9,
}
const ITEM_COLOR: Record<string, number> = {
  bed: 0x7f8ac9, sofa: 0x9c7b5a, desk: 0x6ea27a, stove: 0xd06b5c, sink: 0x7fa6c9, fridge: 0xcfd3d8, toilet: 0xe6e9ee, altar: 0xc85a4d, tv: 0x444444, mirror: 0xbfe3ff,
  beam: 0x8a8a8a, column: 0x8a8a8a, stairs: 0x9a8f80, elevator: 0x9a9a9a, aquarium: 0x6fb6e0, plant: 0x5f9a5f, lamp: 0xf2d27a, mainDoor: 0xb5763b, door: 0xc9944f, window: 0x9fd3ff,
}

function labelSprite(text: string, color = '#18181b', bg = 'rgba(255,255,255,0.85)'): THREE.Sprite {
  const c = document.createElement('canvas')
  const s = 128
  c.width = s * 2; c.height = s
  const g = c.getContext('2d')!
  g.fillStyle = bg; roundRect(g, 8, 24, s * 2 - 16, s - 48, 24); g.fill()
  g.fillStyle = color; g.font = '600 44px -apple-system, "PingFang TC", "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(text, s, s / 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  sp.scale.set(1.4, 0.7, 1)
  return sp
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath() }

export function createHouse3D(plan: FloorPlan): House3D {
  const outline = plan.outline.length >= 3 ? plan.outline : [{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 600 }, { x: 0, y: 600 }]
  const b = bbox(outline)
  const center = polygonCentroid(outline)
  const size = Math.max(b.maxX - b.minX, b.maxY - b.minY) / 100
  const C = new THREE.Vector3(toM(center.x), 0, toM(center.y))

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  const scene = new THREE.Scene()
  scene.background = null
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)

  // lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a30, 0.9))
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.1)
  sun.position.set(C.x + size, size * 1.4, C.z + size * 0.6)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const sc = size * 1.2
  sun.shadow.camera.left = -sc; sun.shadow.camera.right = sc; sun.shadow.camera.top = sc; sun.shadow.camera.bottom = -sc
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = size * 5
  sun.target.position.copy(C)
  scene.add(sun, sun.target)

  // ground
  const ground = new THREE.Mesh(new THREE.CircleGeometry(size * 2.2, 64), new THREE.MeshStandardMaterial({ color: 0x1f2024, roughness: 1 }))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(C.x, -0.02, C.z)
  ground.receiveShadow = true
  scene.add(ground)

  // floor
  const floorShape = new THREE.Shape(outline.map((p) => new THREE.Vector2(toM(p.x), toM(p.y))))
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(floorShape), new THREE.MeshStandardMaterial({ color: 0xf1ede6, roughness: 0.9 }))
  floor.rotation.x = Math.PI / 2 // shape y → world z (y down on plan = +z)
  floor.scale.y = -1 // keep winding so the face points up
  floor.position.y = 0
  floor.receiveShadow = true
  scene.add(floor)

  // rooms as tinted floor patches
  for (const r of plan.rooms) {
    if (r.polygon.length < 3) continue
    const sh = new THREE.Shape(r.polygon.map((p) => new THREE.Vector2(toM(p.x), toM(p.y))))
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: ROOM_COLOR[r.type] ?? 0xcccccc, roughness: 0.95, transparent: true, opacity: 0.6 }))
    m.rotation.x = Math.PI / 2; m.scale.y = -1; m.position.y = 0.005
    m.receiveShadow = true
    scene.add(m)
    const c = polygonCentroid(r.polygon)
    const sp = labelSprite(r.name || roomZh(r))
    sp.position.set(toM(c.x), 1.1, toM(c.y))
    scene.add(sp)
  }

  // walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf7f5f0, roughness: 0.85 })
  const partMat = new THREE.MeshStandardMaterial({ color: 0xece8e0, roughness: 0.9, transparent: true, opacity: 0.85 })
  const addWall = (a: Point, bpt: Point, thick: number, h: number, mat: THREE.Material) => {
    const ax = toM(a.x), az = toM(a.y), bx = toM(bpt.x), bz = toM(bpt.y)
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 0.01) return
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, thick), mat)
    m.position.set((ax + bx) / 2, h / 2, (az + bz) / 2)
    m.rotation.y = -Math.atan2(bz - az, bx - ax)
    m.castShadow = true; m.receiveShadow = true
    scene.add(m)
  }
  for (let i = 0; i < outline.length; i++) addWall(outline[i]!, outline[(i + 1) % outline.length]!, 0.18, WALL_H, wallMat)
  for (const r of plan.rooms) {
    if (r.polygon.length < 3) continue
    for (let i = 0; i < r.polygon.length; i++) addWall(r.polygon[i]!, r.polygon[(i + 1) % r.polygon.length]!, 0.08, WALL_H * 0.75, partMat)
  }

  // items
  const roomOf = (it: Item): Room | undefined => plan.rooms.find((r) => r.id === it.roomId)
  for (const it of plan.items) {
    const w = toM(it.w), d = toM(it.h)
    const cx = toM(it.x + it.w / 2), cz = toM(it.y + it.h / 2)
    const rotY = -(it.facing * Math.PI) / 180
    let h = 0.5
    if (it.type === 'bed') h = 0.5
    else if (it.type === 'sofa') h = 0.8
    else if (it.type === 'desk' || it.type === 'stove' || it.type === 'sink') h = 0.85
    else if (it.type === 'fridge' || it.type === 'stairs' || it.type === 'elevator') h = 1.8
    else if (it.type === 'toilet') h = 0.45
    else if (it.type === 'altar') h = 1.2
    else if (it.type === 'tv') h = 0.9
    else if (it.type === 'mirror') h = 1.6
    else if (it.type === 'plant') h = 1.0
    else if (it.type === 'column') h = WALL_H
    else if (it.type === 'aquarium') h = 0.9
    const isWallThing = it.type === 'mainDoor' || it.type === 'door' || it.type === 'window'
    const isCeiling = it.type === 'beam' || it.type === 'lamp'
    if (isWallThing) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, it.type === 'window' ? 1.2 : 2.1, Math.max(d, 0.12) + 0.06), new THREE.MeshStandardMaterial({ color: ITEM_COLOR[it.type], roughness: 0.6, transparent: it.type === 'window', opacity: it.type === 'window' ? 0.55 : 1 }))
      m.position.set(cx, it.type === 'window' ? 1.5 : 1.05, cz)
      m.rotation.y = rotY
      scene.add(m)
      const sp = labelSprite(ITEM_ZH[it.type][0]!, '#ffffff', 'rgba(24,24,27,0.75)')
      sp.scale.set(0.7, 0.35, 1); sp.position.set(cx, it.type === 'window' ? 2.3 : 2.4, cz)
      scene.add(sp)
      continue
    }
    if (isCeiling) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, it.type === 'beam' ? toM(it.depthCm ?? 30) : 0.25, d), new THREE.MeshStandardMaterial({ color: ITEM_COLOR[it.type], roughness: 0.7 }))
      m.position.set(cx, it.type === 'beam' ? WALL_H - toM(it.depthCm ?? 30) / 2 : WALL_H - 0.5, cz)
      m.rotation.y = rotY
      m.castShadow = true
      scene.add(m)
      continue
    }
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: ITEM_COLOR[it.type] ?? 0xbbbbbb, roughness: 0.7 }))
    m.position.set(cx, h / 2, cz)
    m.rotation.y = rotY
    m.castShadow = true; m.receiveShadow = true
    scene.add(m)
    // facing arrow (headboard / front)
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x2e8f6e }))
    arrow.rotation.x = Math.PI / 2
    const ar = new THREE.Group(); ar.add(arrow); arrow.position.set(0, 0, -d / 2 - 0.2)
    ar.position.set(cx, h + 0.1, cz); ar.rotation.y = rotY
    scene.add(ar)
    const sp = labelSprite(ITEM_ZH[it.type][0]!, '#ffffff', 'rgba(24,24,27,0.75)')
    sp.scale.set(0.7, 0.35, 1); sp.position.set(cx, h + 0.7, cz)
    scene.add(sp)
    void roomOf
  }

  // palace overlay on the floor (8 fans) + highlight rings
  const overlayGroup = new THREE.Group()
  overlayGroup.position.y = 0.012
  scene.add(overlayGroup)
  const R = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 200
  const fans = new Map<Trigram, THREE.Mesh>()
  const labels = new Map<Trigram, THREE.Sprite>()
  for (const t of TRIGRAMS_CLOCKWISE) {
    const a0 = THREE.MathUtils.degToRad(PALACES[t].bearing - 22.5 - plan.northOffset - 90)
    const a1 = THREE.MathUtils.degToRad(PALACES[t].bearing + 22.5 - plan.northOffset - 90)
    const geo = new THREE.RingGeometry(0.2, R, 24, 1, a0, a1 - a0)
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }))
    mesh.rotation.x = -Math.PI / 2
    mesh.scale.y = -1 // plan y-down → world +z while keeping clockwise bearings
    mesh.position.set(C.x, 0, C.z)
    overlayGroup.add(mesh)
    fans.set(t, mesh)
    const mid = THREE.MathUtils.degToRad(PALACES[t].bearing - plan.northOffset)
    const sp = labelSprite(`${PALACES[t].zh}·${PALACES[t].direction}`, '#f4f4f5', 'rgba(24,24,27,0.6)')
    sp.scale.set(1.1, 0.55, 1)
    sp.position.set(C.x + Math.sin(mid) * R * 0.78, 0.05, C.z - Math.cos(mid) * R * 0.78)
    sp.visible = false
    overlayGroup.add(sp)
    labels.set(t, sp)
  }
  // north marker
  const nAng = THREE.MathUtils.degToRad(-plan.northOffset)
  const nSp = labelSprite('N', '#ffffff', 'rgba(192,57,43,0.9)')
  nSp.scale.set(0.6, 0.3, 1)
  nSp.position.set(C.x + Math.sin(nAng) * R * 1.05, 0.3, C.z - Math.cos(nAng) * R * 1.05)
  scene.add(nSp)

  // camera state
  const camPos = new THREE.Vector3(C.x + size * 1.2, size * 1.0, C.z + size * 1.4)
  const camTarget = C.clone()
  const wantPos = camPos.clone(), wantTarget = camTarget.clone()
  let autoRotate = true
  let orbitAngle = 0.6
  let raf = 0
  let el: HTMLElement | null = null

  const resize = () => {
    if (!el) return
    const w = el.clientWidth, h = el.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / Math.max(1, h)
    camera.updateProjectionMatrix()
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null

  const tick = () => {
    raf = requestAnimationFrame(tick)
    if (autoRotate) {
      orbitAngle += 0.0035
      wantPos.set(C.x + Math.sin(orbitAngle) * size * 1.5, size * 0.9, C.z + Math.cos(orbitAngle) * size * 1.5)
      wantTarget.copy(C)
    }
    camPos.lerp(wantPos, 0.06)
    camTarget.lerp(wantTarget, 0.06)
    camera.position.copy(camPos)
    camera.lookAt(camTarget)
    renderer.render(scene, camera)
  }

  return {
    mount: (target) => {
      el = target
      target.appendChild(renderer.domElement)
      renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; renderer.domElement.style.display = 'block'
      resize(); ro?.observe(target)
      cancelAnimationFrame(raf); tick()
    },
    dispose: () => {
      cancelAnimationFrame(raf); ro?.disconnect()
      renderer.dispose(); renderer.domElement.remove()
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose() })
    },
    goTo: (cue) => {
      autoRotate = false
      if (cue.kind === 'orbit') { autoRotate = true; return }
      if (cue.kind === 'top') { wantPos.set(C.x, size * 1.9, C.z + 0.01); wantTarget.copy(C); return }
      if (cue.kind === 'door') {
        const d = plan.items.find((i) => i.type === 'mainDoor')
        if (!d) { wantPos.set(C.x + size * 0.9, size * 0.7, C.z + size * 1.1); wantTarget.copy(C); return }
        const dx = toM(d.x + d.w / 2), dz = toM(d.y + d.h / 2)
        const rad = (d.facing * Math.PI) / 180
        const inward = new THREE.Vector3(Math.sin(rad), 0, -Math.cos(rad)) // screen angle 0 = up = −z
        // stand 3 m outside the door, 1.6 m high, look through it
        wantPos.set(dx - inward.x * 3, 1.7, dz - inward.z * 3)
        wantTarget.set(dx + inward.x * 3, 1.0, dz + inward.z * 3)
        return
      }
      if (cue.kind === 'room') {
        const r = plan.rooms.find((x) => x.id === cue.roomId)
        if (!r) return
        const c = polygonCentroid(r.polygon)
        const rb = bbox(r.polygon)
        const rs = Math.max(rb.maxX - rb.minX, rb.maxY - rb.minY) / 100
        const dir = new THREE.Vector3(toM(c.x) - C.x, 0, toM(c.y) - C.z)
        if (dir.length() < 0.2) dir.set(0.3, 0, 1)
        dir.normalize()
        wantTarget.set(toM(c.x), 0.6, toM(c.y))
        wantPos.set(toM(c.x) + dir.x * (rs * 1.1 + 1.2), rs * 1.0 + 2.0, toM(c.y) + dir.z * (rs * 1.1 + 1.2))
      }
    },
    setOverlay: (palette, highlight) => {
      for (const t of TRIGRAMS_CLOCKWISE) {
        const mesh = fans.get(t)!
        const mat = mesh.material as THREE.MeshBasicMaterial
        const col = palette[t]
        const hl = highlight.includes(t)
        if (col) { mat.color.set(col); mat.opacity = hl ? 0.55 : 0.28 } else { mat.opacity = hl ? 0.35 : 0 ; mat.color.set(hl ? '#2e8f6e' : '#ffffff') }
        labels.get(t)!.visible = !!col || hl
      }
    },
    setAutoRotate: (on) => { autoRotate = on },
  }
}

function roomZh(r: Room): string {
  const m: Record<string, string> = { living: '客廳', bedroom: '臥室', master: '主臥', kids: '兒童房', study: '書房', kitchen: '廚房', dining: '餐廳', bathroom: '廁所', entry: '玄關', balcony: '陽台', altar: '神明廳', storage: '儲藏', corridor: '走道', driveway: '騎樓', void: '挑空', other: '房間' }
  return m[r.type] ?? '房間'
}
