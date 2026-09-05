import { PALACES, type Trigram } from '../bagua'
import { bearingOfPoint, palaceOfBearing } from '../direction'
import { bbox, dirVec, dist, pointInPolygon, polygonCentroid, rectCenter, rectCorners, segmentCrossesPolygonEdges, type Point, type Rect, type Segment } from '../geometry'
import type { FloorPlan, Item, ItemType, Room } from '../floorplan'

export interface PlanContext {
  plan: FloorPlan
  center: Point
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  items: (t: ItemType) => Item[]
  roomAt: (p: Point) => Room | undefined
  roomOf: (item: Item) => Room | undefined
  palaceOf: (p: Point) => Trigram
  bearingOf: (p: Point) => number
  /** compass bearing for a screen-angle facing */
  facingBearing: (screenAngle: number) => number
  /** true if straight line between a and b crosses a wall (outline or room edge) */
  blocked: (a: Point, b: Point) => boolean
  centerOf: (r: Rect) => Point
  /** point in front of an item along its facing, at distance d */
  front: (item: Item, d: number) => Point
  /** point behind an item, at distance d */
  back: (item: Item, d: number) => Point
  /** nearest distance from point to any wall edge (outline + rooms) */
  wallDistance: (p: Point) => number
  /** is a window within d cm of point */
  windowNear: (p: Point, d: number) => Item | undefined
  /** item's palace by centre */
  palaceOfItem: (i: Item) => Trigram
  palaceZh: (t: Trigram) => string
}

export function buildContext(plan: FloorPlan): PlanContext {
  const outline = plan.outline.length >= 3 ? plan.outline : fallbackOutline(plan)
  const center = polygonCentroid(outline)
  const bounds = bbox(outline)
  const walls: Point[][] = [outline, ...plan.rooms.map((r) => r.polygon).filter((p) => p.length >= 3)]

  const items = (t: ItemType) => plan.items.filter((i) => i.type === t)
  const roomAt = (p: Point) => plan.rooms.find((r) => r.polygon.length >= 3 && pointInPolygon(p, r.polygon))
  const roomOf = (item: Item) => (item.roomId ? plan.rooms.find((r) => r.id === item.roomId) : undefined) ?? roomAt(rectCenter(item))
  const bearingOf = (p: Point) => bearingOfPoint(center.x, center.y, p.x, p.y, plan.northOffset)
  const palaceOf = (p: Point) => palaceOfBearing(bearingOf(p))
  const facingBearing = (a: number) => ((a + plan.northOffset) % 360 + 360) % 360
  const blocked = (a: Point, b: Point) => {
    const seg: Segment = { a, b }
    return walls.some((w) => segmentCrossesPolygonEdges(seg, w, 12))
  }
  const front = (item: Item, d: number) => {
    const c = rectCenter(item), v = dirVec(item.facing)
    return { x: c.x + v.x * d, y: c.y + v.y * d }
  }
  const back = (item: Item, d: number) => front(item, -d)
  const wallDistance = (p: Point) => {
    let best = Infinity
    for (const w of walls) for (let i = 0; i < w.length; i++) {
      const s: Segment = { a: w[i]!, b: w[(i + 1) % w.length]! }
      best = Math.min(best, distToSeg(p, s))
    }
    return best
  }
  const windowNear = (p: Point, d: number) => items('window').find((w) => rectCorners(w).some((c) => dist(c, p) <= d) || dist(rectCenter(w), p) <= d)
  const palaceOfItem = (i: Item) => palaceOf(rectCenter(i))
  const palaceZh = (t: Trigram) => `${PALACES[t].zh}（${PALACES[t].direction}）`
  return { plan, center, bounds, items, roomAt, roomOf, palaceOf, bearingOf, facingBearing, blocked, centerOf: rectCenter, front, back, wallDistance, windowNear, palaceOfItem, palaceZh }
}

function distToSeg(p: Point, s: Segment): number {
  const l2 = dist(s.a, s.b) ** 2
  if (l2 === 0) return dist(p, s.a)
  let t = ((p.x - s.a.x) * (s.b.x - s.a.x) + (p.y - s.a.y) * (s.b.y - s.a.y)) / l2
  t = Math.max(0, Math.min(1, t))
  return dist(p, { x: s.a.x + t * (s.b.x - s.a.x), y: s.a.y + t * (s.b.y - s.a.y) })
}

function fallbackOutline(plan: FloorPlan): Point[] {
  const pts = [...plan.rooms.flatMap((r) => r.polygon), ...plan.items.flatMap((i) => rectCorners(i))]
  if (pts.length === 0) return [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]
  const b = bbox(pts)
  return [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY }, { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY }]
}

/** Two items "face each other": facing directions roughly opposite and each lies in front of the other. */
export function faceEachOther(ctx: PlanContext, a: Item, b: Item, maxDist: number, angleTol = 25): boolean {
  const ca = ctx.centerOf(a), cb = ctx.centerOf(b)
  const d = dist(ca, cb)
  if (d > maxDist || d === 0) return false
  const toB = screenAng(ca, cb)
  const toA = screenAng(cb, ca)
  return angDiff(a.facing, toB) <= angleTol && angDiff(b.facing, toA) <= angleTol && !ctx.blocked(ca, cb)
}

/** Item `a` faces item `b` (b lies within a corridor in front of a). */
export function facesItem(ctx: PlanContext, a: Item, b: Item, maxDist: number, angleTol = 20): boolean {
  const ca = ctx.centerOf(a), cb = ctx.centerOf(b)
  const d = dist(ca, cb)
  if (d > maxDist || d === 0) return false
  const toB = screenAng(ca, cb)
  return angDiff(a.facing, toB) <= angleTol && !ctx.blocked(ca, cb)
}

export function screenAng(a: Point, b: Point): number {
  const d = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI
  return ((d % 360) + 360) % 360
}

export function angDiff(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360)
  return Math.min(d, 360 - d)
}

export function overlaps(a: Rect, b: Rect): boolean {
  const ac = rectCorners(a), bc = rectCorners(b)
  const ab = bbox(ac), bb = bbox(bc)
  return ab.minX < bb.maxX && ab.maxX > bb.minX && ab.minY < bb.maxY && ab.maxY > bb.minY
}

/** Head-edge midpoint of a bed (床頭中點): the edge in the `facing` direction. */
export function headPoint(ctx: PlanContext, bed: Item): Point {
  return ctx.front(bed, bed.h / 2)
}
