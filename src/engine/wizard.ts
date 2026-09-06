import { ITEM_DEFAULT, type Item, type ItemType, type Room, type RoomType } from './floorplan'
import { bbox, pointInPolygon, type Point } from './geometry'

export type Shape = 'rect' | 'L'
export type Corner = 'tl' | 'tr' | 'bl' | 'br'
export type Wall = 'top' | 'bottom' | 'left' | 'right'
export const WALL_ZH: Record<Wall, string> = { top: '上', bottom: '下', left: '左', right: '右' }

/** Outline (cm) from overall size; L shape removes a notch at one corner. */
export function outlineFromDims(widthM: number, depthM: number, shape: Shape = 'rect', corner: Corner = 'tr', notchWM = 0, notchDM = 0): Point[] {
  const W = Math.round(widthM * 100), D = Math.round(depthM * 100)
  if (shape === 'rect' || notchWM <= 0 || notchDM <= 0) return [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }]
  const nw = Math.min(Math.round(notchWM * 100), W - 100), nd = Math.min(Math.round(notchDM * 100), D - 100)
  switch (corner) {
    case 'tr': return [{ x: 0, y: 0 }, { x: W - nw, y: 0 }, { x: W - nw, y: nd }, { x: W, y: nd }, { x: W, y: D }, { x: 0, y: D }]
    case 'tl': return [{ x: nw, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }, { x: 0, y: nd }, { x: nw, y: nd }]
    case 'br': return [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D - nd }, { x: W - nw, y: D - nd }, { x: W - nw, y: D }, { x: 0, y: D }]
    case 'bl': return [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: nw, y: D }, { x: nw, y: D - nd }, { x: 0, y: D - nd }]
  }
}

/** Main door on a wall of the outline bbox at fraction t (0..1) along it; facing points inward. */
export function doorOnWall(outline: Point[], wall: Wall, t: number, type: ItemType = 'mainDoor'): Omit<Item, 'id'> {
  const b = bbox(outline)
  const size = ITEM_DEFAULT[type]
  const w = size.w, h = size.h
  const along = (wall === 'top' || wall === 'bottom') ? b.minX + (b.maxX - b.minX) * t : b.minY + (b.maxY - b.minY) * t
  // choose the actual wall coordinate at that position (handles L shapes): scan for the outline edge on that side
  const edgeCoord = wallCoordAt(outline, wall, along)
  const facing = wall === 'top' ? 180 : wall === 'bottom' ? 0 : wall === 'left' ? 90 : 270
  const cx = wall === 'top' || wall === 'bottom' ? along : edgeCoord
  const cy = wall === 'top' || wall === 'bottom' ? edgeCoord : along
  return { type, x: cx - w / 2, y: cy - h / 2, w, h, facing }
}

/** For a rectilinear outline, the coordinate of the boundary on `wall` at a position along it. */
function wallCoordAt(outline: Point[], wall: Wall, along: number): number {
  const b = bbox(outline)
  const horizontal = wall === 'top' || wall === 'bottom'
  let best: number | null = null
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!, c = outline[(i + 1) % outline.length]!
    if (horizontal && Math.abs(a.y - c.y) < 1e-6 && along >= Math.min(a.x, c.x) - 1e-6 && along <= Math.max(a.x, c.x) + 1e-6) {
      if (best === null || (wall === 'top' ? a.y < best : a.y > best)) best = a.y
    }
    if (!horizontal && Math.abs(a.x - c.x) < 1e-6 && along >= Math.min(a.y, c.y) - 1e-6 && along <= Math.max(a.y, c.y) + 1e-6) {
      if (best === null || (wall === 'left' ? a.x < best : a.x > best)) best = a.x
    }
  }
  return best ?? (wall === 'top' ? b.minY : wall === 'bottom' ? b.maxY : wall === 'left' ? b.minX : b.maxX)
}

export interface Cell { col: number; row: number; x: number; y: number; w: number; h: number }

/** Grid cells over the outline bbox whose centre lies inside the outline. */
export function gridCells(outline: Point[], cols: number, rows: number): Cell[] {
  const b = bbox(outline)
  const cw = (b.maxX - b.minX) / cols, ch = (b.maxY - b.minY) / rows
  const out: Cell[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = b.minX + c * cw, y = b.minY + r * ch
    if (pointInPolygon({ x: x + cw / 2, y: y + ch / 2 }, outline)) out.push({ col: c, row: r, x, y, w: cw, h: ch })
  }
  return out
}

/** Union of axis-aligned cells into one rectilinear polygon (null if not a single simple loop). */
export function unionCells(cells: Cell[]): Point[] | null {
  if (!cells.length) return null
  const key = (p: Point) => `${Math.round(p.x * 10)},${Math.round(p.y * 10)}`
  const edges = new Map<string, [Point, Point]>()
  const toggle = (a: Point, b: Point) => {
    const k1 = `${key(a)}|${key(b)}`, k2 = `${key(b)}|${key(a)}`
    if (edges.has(k1)) edges.delete(k1)
    else if (edges.has(k2)) edges.delete(k2)
    else edges.set(k1, [a, b])
  }
  for (const c of cells) {
    const p1 = { x: c.x, y: c.y }, p2 = { x: c.x + c.w, y: c.y }, p3 = { x: c.x + c.w, y: c.y + c.h }, p4 = { x: c.x, y: c.y + c.h }
    toggle(p1, p2); toggle(p2, p3); toggle(p3, p4); toggle(p4, p1)
  }
  const remaining = [...edges.values()]
  if (!remaining.length) return null
  // chain edges (undirected)
  const loop: Point[] = [remaining[0]![0], remaining[0]![1]]
  remaining.splice(0, 1)
  const startK = key(loop[0]!)
  let guard = 0
  while (remaining.length && guard++ < 10000) {
    const cur = loop[loop.length - 1]!
    const ck = key(cur)
    const idx = remaining.findIndex(([a, b]) => key(a) === ck || key(b) === ck)
    if (idx < 0) return null
    const [a, b] = remaining[idx]!
    remaining.splice(idx, 1)
    const next = key(a) === ck ? b : a
    if (key(next) === startK) break
    loop.push(next)
  }
  if (remaining.length) return null // more than one loop (holes or disjoint)
  // drop collinear points
  const out: Point[] = []
  for (let i = 0; i < loop.length; i++) {
    const a = loop[(i + loop.length - 1) % loop.length]!, b = loop[i]!, c = loop[(i + 1) % loop.length]!
    const collinear = (Math.abs(a.x - b.x) < 1e-6 && Math.abs(b.x - c.x) < 1e-6) || (Math.abs(a.y - b.y) < 1e-6 && Math.abs(b.y - c.y) < 1e-6)
    if (!collinear) out.push({ x: Math.round(b.x), y: Math.round(b.y) })
  }
  return out.length >= 4 ? out : null
}

/** Group painted cells by type and connectivity into rooms. */
export function cellsToRooms(cells: Cell[], paint: Record<string, RoomType | undefined>): Omit<Room, 'id'>[] {
  const byKey = new Map(cells.map((c) => [`${c.col},${c.row}`, c]))
  const seen = new Set<string>()
  const rooms: Omit<Room, 'id'>[] = []
  for (const c of cells) {
    const k = `${c.col},${c.row}`
    const type = paint[k]
    if (!type || seen.has(k)) continue
    // flood fill same type
    const group: Cell[] = []
    const stack = [c]
    seen.add(k)
    while (stack.length) {
      const cur = stack.pop()!
      group.push(cur)
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nk = `${cur.col + dc},${cur.row + dr}`
        const n = byKey.get(nk)
        if (n && !seen.has(nk) && paint[nk] === type) { seen.add(nk); stack.push(n) }
      }
    }
    const poly = unionCells(group)
    if (poly) rooms.push({ type, polygon: poly })
    else for (const g of group) rooms.push({ type, polygon: [{ x: g.x, y: g.y }, { x: g.x + g.w, y: g.y }, { x: g.x + g.w, y: g.y + g.h }, { x: g.x, y: g.y + g.h }] })
  }
  return rooms
}

/** Place an item against a wall of a room (bbox based). Facing follows the app's conventions. */
export function placeAgainstWall(room: Room, type: ItemType, wall: Wall): Omit<Item, 'id'> {
  const b = bbox(room.polygon)
  const size = ITEM_DEFAULT[type]
  const cx0 = (b.minX + b.maxX) / 2, cy0 = (b.minY + b.maxY) / 2
  // facing conventions: bed = head direction (toward wall); desk = person faces (toward wall);
  // stove/toilet/sofa/altar/tv = front faces away from wall
  const towardWall: Record<Wall, number> = { top: 0, bottom: 180, left: 270, right: 90 }
  const awayFromWall: Record<Wall, number> = { top: 180, bottom: 0, left: 90, right: 270 }
  const facesWall = type === 'bed' || type === 'desk'
  const facing = facesWall ? towardWall[wall] : awayFromWall[wall]
  // footprint after rotation: for facing 90/270 the rect is rotated, so extent along x is h and along y is w
  const rotated = facing === 90 || facing === 270
  const extX = rotated ? size.h : size.w, extY = rotated ? size.w : size.h
  const gap = 5
  let cx = cx0, cy = cy0
  if (wall === 'top') cy = b.minY + extY / 2 + gap
  if (wall === 'bottom') cy = b.maxY - extY / 2 - gap
  if (wall === 'left') cx = b.minX + extX / 2 + gap
  if (wall === 'right') cx = b.maxX - extX / 2 - gap
  return { type, x: cx - size.w / 2, y: cy - size.h / 2, w: size.w, h: size.h, facing, roomId: room.id }
}

/** Suggested key item for a room type (what the wizard asks about). */
export function keyItemFor(type: RoomType): { item: ItemType; question: string } | null {
  switch (type) {
    case 'master': case 'bedroom': case 'kids': return { item: 'bed', question: '床頭靠哪面牆？' }
    case 'kitchen': return { item: 'stove', question: '爐灶靠哪面牆？' }
    case 'bathroom': return { item: 'toilet', question: '馬桶靠哪面牆？' }
    case 'study': return { item: 'desk', question: '書桌面向哪面牆？' }
    case 'living': return { item: 'sofa', question: '沙發靠哪面牆？' }
    case 'altar': return { item: 'altar', question: '神位靠哪面牆？' }
    default: return null
  }
}

/** Room door on the wall closest to the house side (for wizard: put a door on the wall facing the corridor/living). */
export function roomDoorTowards(room: Room, target: Point): Omit<Item, 'id'> {
  const b = bbox(room.polygon)
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2
  const dx = target.x - cx, dy = target.y - cy
  const wall: Wall = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top')
  const facing = wall === 'top' ? 180 : wall === 'bottom' ? 0 : wall === 'left' ? 90 : 270 // opens into the room
  const size = ITEM_DEFAULT.door
  const px = wall === 'left' ? b.minX : wall === 'right' ? b.maxX : cx
  const py = wall === 'top' ? b.minY : wall === 'bottom' ? b.maxY : cy
  return { type: 'door', x: px - size.w / 2, y: py - size.h / 2, w: size.w, h: size.h, facing, roomId: room.id }
}
