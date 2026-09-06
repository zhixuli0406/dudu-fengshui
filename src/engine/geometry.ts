export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number; rotation?: number; /** items store their rotation as `facing` */ facing?: number }
export interface Segment { a: Point; b: Point }

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function polygonArea(poly: Point[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!
    s += p.x * q.y - q.x * p.y
  }
  return Math.abs(s) / 2
}

/** Area centroid of a simple polygon. */
export function polygonCentroid(poly: Point[]): Point {
  if (poly.length === 0) return { x: 0, y: 0 }
  if (poly.length < 3) return { x: poly.reduce((a, p) => a + p.x, 0) / poly.length, y: poly.reduce((a, p) => a + p.y, 0) / poly.length }
  let cx = 0, cy = 0, s = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!
    const cross = p.x * q.y - q.x * p.y
    s += cross
    cx += (p.x + q.x) * cross
    cy += (p.y + q.y) * cross
  }
  if (Math.abs(s) < 1e-9) return { x: poly[0]!.x, y: poly[0]!.y }
  return { x: cx / (3 * s), y: cy / (3 * s) }
}

export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!
    const intersect = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    if (intersect) inside = !inside
  }
  return inside
}

export function bbox(poly: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y)
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

/** Corner points of a rectangle rotated about its centre by `rotation` (or an item's `facing`). */
export function rectCorners(r: Rect): Point[] {
  const c = rectCenter(r)
  const rot = ((r.rotation ?? r.facing ?? 0) * Math.PI) / 180
  const hw = r.w / 2, hh = r.h / 2
  const pts = [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }]
  return pts.map((p) => ({ x: c.x + p.x * Math.cos(rot) - p.y * Math.sin(rot), y: c.y + p.x * Math.sin(rot) + p.y * Math.cos(rot) }))
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function segmentsIntersect(s1: Segment, s2: Segment): boolean {
  const o = (p: Point, q: Point, r: Point) => {
    const v = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)
    return Math.abs(v) < 1e-9 ? 0 : v > 0 ? 1 : 2
  }
  const on = (p: Point, q: Point, r: Point) => q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y)
  const o1 = o(s1.a, s1.b, s2.a), o2 = o(s1.a, s1.b, s2.b), o3 = o(s2.a, s2.b, s1.a), o4 = o(s2.a, s2.b, s1.b)
  if (o1 !== o2 && o3 !== o4) return true
  if (o1 === 0 && on(s1.a, s2.a, s1.b)) return true
  if (o2 === 0 && on(s1.a, s2.b, s1.b)) return true
  if (o3 === 0 && on(s2.a, s1.a, s2.b)) return true
  if (o4 === 0 && on(s2.a, s1.b, s2.b)) return true
  return false
}

/** Whether segment a-b crosses any edge of polygon (used for line-of-sight through walls). */
export function segmentCrossesPolygonEdges(seg: Segment, poly: Point[], ignoreNear = 5): boolean {
  for (let i = 0; i < poly.length; i++) {
    const e: Segment = { a: poly[i]!, b: poly[(i + 1) % poly.length]! }
    if (segmentsIntersect(seg, e)) {
      // ignore edges the endpoints sit on (doors are on walls)
      if (distToSegment(seg.a, e) < ignoreNear || distToSegment(seg.b, e) < ignoreNear) continue
      return true
    }
  }
  return false
}

export function distToSegment(p: Point, s: Segment): number {
  const l2 = dist(s.a, s.b) ** 2
  if (l2 === 0) return dist(p, s.a)
  let t = ((p.x - s.a.x) * (s.b.x - s.a.x) + (p.y - s.a.y) * (s.b.y - s.a.y)) / l2
  t = Math.max(0, Math.min(1, t))
  return dist(p, { x: s.a.x + t * (s.b.x - s.a.x), y: s.a.y + t * (s.b.y - s.a.y) })
}

/** Angle in degrees (screen coords, 0 = up, clockwise) from a to b. */
export function screenAngle(a: Point, b: Point): number {
  const d = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI
  return ((d % 360) + 360) % 360
}

export function angleBetween(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360)
  return Math.min(d, 360 - d)
}

/** Direction unit vector for a screen angle (0 = up). */
export function dirVec(angle: number): Point {
  const r = (angle * Math.PI) / 180
  return { x: Math.sin(r), y: -Math.cos(r) }
}

/** Ray from origin along angle hits rect? Returns distance or null. */
export function rayHitsRect(origin: Point, angle: number, r: Rect, halfWidth = 0): number | null {
  const d = dirVec(angle)
  const corners = rectCorners(r)
  // sample: check if any corner or centre lies within a corridor of halfWidth along the ray
  const pts = [...corners, rectCenter(r)]
  let best: number | null = null
  for (const p of pts) {
    const vx = p.x - origin.x, vy = p.y - origin.y
    const along = vx * d.x + vy * d.y
    if (along <= 0) continue
    const perp = Math.abs(vx * d.y - vy * d.x)
    if (perp <= halfWidth + Math.max(r.w, r.h) / 2) best = best === null ? along : Math.min(best, along)
  }
  return best
}

/** Notch (缺角) detection on an orthogonal-ish polygon: compares polygon to its bbox in 8 sectors. */
export function missingCornerRatio(poly: Point[], sectorPolygonPoints: Point[]): number {
  // fraction of sector sample points that fall outside the polygon
  let outside = 0
  for (const p of sectorPolygonPoints) if (!pointInPolygon(p, poly)) outside++
  return sectorPolygonPoints.length ? outside / sectorPolygonPoints.length : 0
}
