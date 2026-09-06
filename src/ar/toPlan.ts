import { ITEM_DEFAULT, type FloorPlan, type Item, type ItemType, type Room, type RoomType, ROOM_ZH } from '../engine/floorplan'
import { pointInPolygon, polygonCentroid, type Point } from '../engine/geometry'
import type { ARPoint, CapturedItem, CapturedOpening, CapturedPolygon } from './arSession'

export interface ARCapture {
  polygons: CapturedPolygon[]
  openings: CapturedOpening[]
  items: CapturedItem[]
  /** compass bearing the XR forward axis (−z) points to; null when the compass never reported */
  northOffset: number | null
}

const ROOM_BY_LABEL = new Map((Object.keys(ROOM_ZH) as RoomType[]).map((t) => [ROOM_ZH[t], t]))
/** Head / seat go against the wall (facing toward it); everything else has its back to the wall. */
const FACES_WALL: ItemType[] = ['bed', 'desk']
/** Beyond this distance from the nearest wall the item is treated as free-standing and the camera yaw decides. */
const FREE_STANDING_CM = 150

/** Screen-degree angle of a vector (0 = up, clockwise). */
const angleOf = (v: Point) => ((Math.atan2(v.x, -v.y) * 180) / Math.PI + 360) % 360
const snap15 = (a: number) => ((Math.round(a / 15) * 15) % 360 + 360) % 360

/** XR metres → plan cm (y down, XR forward = up); origin moved to the outline's top-left. */
function toPlanPoints(pts: ARPoint[], origin: Point): Point[] {
  return pts.map((p) => ({ x: Math.round(p.x * 100) - origin.x, y: Math.round(p.z * 100) - origin.y }))
}

/** Clockwise (screen coords) winding, which the rest of the engine assumes. */
function clockwise(pts: Point[]): Point[] {
  let s = 0
  for (let i = 0; i < pts.length; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; s += (b.x - a.x) * (b.y + a.y) }
  return s < 0 ? pts : [...pts].reverse()
}

interface Wall { a: Point; b: Point; owner: Point; roomId?: string }

/** Nearest wall segment to `p` among the given polygons, and the inward normal (toward the owner's centroid). */
function nearestWall(p: Point, walls: Wall[]): { d: number; inward: number; wall: Wall } | null {
  let best: { d: number; inward: number; wall: Wall } | null = null
  for (const w of walls) {
    const { a, b } = w
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2))
    const q = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
    const d = Math.hypot(p.x - q.x, p.y - q.y)
    if (best && d >= best.d) continue
    const n1 = { x: -(b.y - a.y), y: b.x - a.x }
    const n2 = { x: -n1.x, y: -n1.y }
    const toward = (n: Point) => (w.owner.x - q.x) * n.x + (w.owner.y - q.y) * n.y
    best = { d, inward: angleOf(toward(n1) >= toward(n2) ? n1 : n2), wall: w }
  }
  return best
}

const wallsOf = (poly: Point[], roomId?: string): Wall[] => {
  const owner = polygonCentroid(poly)
  return poly.map((a, i) => ({ a, b: poly[(i + 1) % poly.length]!, owner, roomId }))
}

/** Footprint for an item facing `facing`: the default rect is drawn facing up, so quarter turns swap w/h. */
function footprint(type: ItemType, facing: number, c: Point) {
  const size = ITEM_DEFAULT[type]
  const turned = facing % 180 !== 0
  const w = turned ? size.h : size.w, h = turned ? size.w : size.h
  return { x: c.x - w / 2, y: c.y - h / 2, w, h }
}

/**
 * Turn an AR capture into a plan. Outline and rooms come from the polygons; doors and windows snap to the
 * nearest wall and open inward; furniture takes its room from position and its facing from the nearest wall
 * (bed head / desk toward the wall, stove / sofa / toilet / altar / tv with their back to it), or from the
 * camera yaw when it stands free. Returns null without a usable outline.
 */
export function captureToPlan(cap: ARCapture, base: FloorPlan): FloorPlan | null {
  const outlineAR = cap.polygons.find((p) => p.stage === 'outline')?.pts
  if (!outlineAR || outlineAR.length < 3) return null
  const raw = outlineAR.map((p) => ({ x: Math.round(p.x * 100), y: Math.round(p.z * 100) }))
  const origin = { x: Math.min(...raw.map((q) => q.x)), y: Math.min(...raw.map((q) => q.y)) }
  const outline = clockwise(toPlanPoints(outlineAR, origin))
  const rooms: Room[] = cap.polygons.filter((p) => p.stage === 'room' && p.pts.length >= 3).map((p, i) => ({ id: `r_ar_${i}`, type: ROOM_BY_LABEL.get(p.label ?? '') ?? 'other', polygon: clockwise(toPlanPoints(p.pts, origin)) }))
  const roomWalls = rooms.flatMap((r) => wallsOf(r.polygon, r.id))
  const allWalls = [...wallsOf(outline), ...roomWalls]
  const roomAt = (p: Point) => rooms.find((r) => pointInPolygon(p, r.polygon))

  const items: Item[] = []
  cap.openings.forEach((o, i) => {
    const p = toPlanPoints([o.p], origin)[0]!
    // the main door sits on the outline; room doors and windows may sit on either
    const hit = nearestWall(p, o.kind === 'mainDoor' ? wallsOf(outline) : allWalls)
    const facing = hit ? snap15(hit.inward) : 0
    items.push({ id: `i_ar_${i}`, type: o.kind, ...footprint(o.kind, facing, p), facing, roomId: hit?.wall.roomId ?? roomAt(p)?.id })
  })
  cap.items.forEach((it, i) => {
    const p = toPlanPoints([it.p], origin)[0]!
    const room = roomAt(p)
    const hit = nearestWall(p, room ? wallsOf(room.polygon, room.id) : wallsOf(outline))
    let facing: number
    if (hit && hit.d <= FREE_STANDING_CM) facing = snap15(FACES_WALL.includes(it.type) ? (hit.inward + 180) % 360 : hit.inward)
    else if (typeof it.yaw === 'number') facing = snap15(it.yaw)
    else facing = hit ? snap15(hit.inward) : 0
    items.push({ id: `i_ar_f${i}`, type: it.type, ...footprint(it.type, facing, p), facing, roomId: room?.id })
  })

  return { ...base, outline, rooms, items, northOffset: cap.northOffset != null ? Math.round(cap.northOffset) : base.northOffset }
}

/** Compass bearing the house faces, from the main door's inward facing and the plan's north offset. */
export function facingFromPlan(plan: FloorPlan): number | null {
  const md = plan.items.find((i) => i.type === 'mainDoor')
  if (!md) return null
  return (((md.facing + 180 + plan.northOffset) % 360) + 360) % 360
}
