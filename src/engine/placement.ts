import { ITEM_DEFAULT, type FloorPlan, type Item, type ItemType, type Room } from './floorplan'
import { PALACES } from './bagua'
import { palaceOfBearing } from './direction'
import { pointInPolygon, polygonCentroid, type Point } from './geometry'

/** Screen-degree angle of a vector (0 = up, clockwise). */
export const angleOfVector = (v: Point) => ((Math.atan2(v.x, -v.y) * 180) / Math.PI + 360) % 360

/** Head / seat go against the wall (facing toward it); everything else has its back to the wall. */
const FACES_WALL: ItemType[] = ['bed', 'desk']
const GAP_CM = 5

export interface EdgeHit {
  /** index of the polygon edge (from vertex i to i+1) */
  i: number
  /** closest point on that edge */
  q: Point
  d: number
  /** unit normal pointing into the room */
  inward: Point
  outward: Point
}

/** Closest edge of a polygon to `p`, with normals oriented by the polygon's centroid. Works for any rotation. */
export function nearestEdge(poly: Point[], p: Point): EdgeHit | null {
  if (poly.length < 3) return null
  const c = polygonCentroid(poly)
  let best: EdgeHit | null = null
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!
    const dx = b.x - a.x, dy = b.y - a.y
    const l2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
    const q = { x: a.x + t * dx, y: a.y + t * dy }
    const d = Math.hypot(p.x - q.x, p.y - q.y)
    if (best && d >= best.d) continue
    const len = Math.sqrt(l2)
    let n = { x: -dy / len, y: dx / len }
    if ((c.x - q.x) * n.x + (c.y - q.y) * n.y < 0) n = { x: -n.x, y: -n.y }
    best = { i, q, d, inward: n, outward: { x: -n.x, y: -n.y } }
  }
  return best
}

/** Compass bearing an edge's outward side faces; `northOffset` is the bearing the top of the plan points to. */
export function edgeBearing(poly: Point[], i: number, northOffset: number): number {
  const a = poly[i]!, b = poly[(i + 1) % poly.length]!
  const c = polygonCentroid(poly)
  const dx = b.x - a.x, dy = b.y - a.y
  let n = { x: -dy, y: dx }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  if ((c.x - mid.x) * n.x + (c.y - mid.y) * n.y > 0) n = { x: -n.x, y: -n.y }
  return (((northOffset + angleOfVector(n)) % 360) + 360) % 360
}

export function edgeDirectionZh(poly: Point[], i: number, northOffset: number): string {
  return PALACES[palaceOfBearing(edgeBearing(poly, i, northOffset))].direction
}

/**
 * Put an item against the wall nearest to where the user tapped: bed head / desk toward that wall,
 * everything else with its back to it. Exact angle, so rotated rooms work. `roomId` is filled in.
 */
export function placeAtWall(room: Room, type: ItemType, p: Point): (Omit<Item, 'id'> & { edge: EdgeHit }) | null {
  const hit = nearestEdge(room.polygon, p)
  if (!hit) return null
  const size = ITEM_DEFAULT[type]
  const facing = Math.round(angleOfVector(FACES_WALL.includes(type) ? hit.outward : hit.inward)) % 360
  const depth = size.h / 2 + GAP_CM
  const cx = hit.q.x + hit.inward.x * depth, cy = hit.q.y + hit.inward.y * depth
  return { type, x: Math.round(cx - size.w / 2), y: Math.round(cy - size.h / 2), w: size.w, h: size.h, facing, roomId: room.id, edge: hit }
}

/** First wall hit by a ray from `from` along a screen-degree angle (0 = up, clockwise); null if it escapes. */
export function rayToWall(poly: Point[], from: Point, angleDeg: number): { i: number; q: Point } | null {
  const d = { x: Math.sin((angleDeg * Math.PI) / 180), y: -Math.cos((angleDeg * Math.PI) / 180) }
  let best: { i: number; q: Point; t: number } | null = null
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!
    const ex = b.x - a.x, ey = b.y - a.y
    const den = d.x * ey - d.y * ex
    if (Math.abs(den) < 1e-9) continue
    const t = ((a.x - from.x) * ey - (a.y - from.y) * ex) / den
    const u = ((a.x - from.x) * d.y - (a.y - from.y) * d.x) / den
    if (t > 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 && (!best || t < best.t)) best = { i, q: { x: from.x + d.x * t, y: from.y + d.y * t }, t }
  }
  return best ? { i: best.i, q: best.q } : null
}

/** What lies on the other side of a wall, and whether it carries a door or window: the reference people actually use. */
export function wallContext(plan: Pick<FloorPlan, 'rooms' | 'items'>, room: Room, i: number): { neighbor: Room | null; door: boolean; window: boolean } {
  const poly = room.polygon
  const a = poly[i]!, b = poly[(i + 1) % poly.length]!
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const c = polygonCentroid(poly)
  let n = { x: -(b.y - a.y), y: b.x - a.x }
  const len = Math.hypot(n.x, n.y) || 1
  n = { x: n.x / len, y: n.y / len }
  if ((c.x - mid.x) * n.x + (c.y - mid.y) * n.y > 0) n = { x: -n.x, y: -n.y }
  const outside = { x: mid.x + n.x * 60, y: mid.y + n.y * 60 }
  const neighbor = plan.rooms.find((r) => r.id !== room.id && r.polygon.length >= 3 && pointInPolygon(outside, r.polygon)) ?? null
  const near = (it: Item) => {
    const p = { x: it.x + it.w / 2, y: it.y + it.h / 2 }
    const ex = b.x - a.x, ey = b.y - a.y
    const l2 = ex * ex + ey * ey || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / l2))
    return Math.hypot(p.x - (a.x + t * ex), p.y - (a.y + t * ey)) < 60
  }
  const onWall = plan.items.filter((it) => (it.type === 'door' || it.type === 'window' || it.type === 'mainDoor') && (it.roomId === room.id || !it.roomId || it.roomId === neighbor?.id) && near(it))
  return { neighbor, door: onWall.some((it) => it.type === 'door' || it.type === 'mainDoor'), window: onWall.some((it) => it.type === 'window') }
}
