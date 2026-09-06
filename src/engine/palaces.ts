import { TRIGRAMS_CLOCKWISE, type Trigram } from './bagua'
import { bearingOfPoint, palaceOfBearing } from './direction'
import { bbox, pointInPolygon, polygonCentroid, type Point } from './geometry'

export interface PalaceAnchor { x: number; y: number; /** sampled points inside the outline for this palace */ n: number }

/**
 * Where to put each palace's label inside the house: the centroid of the part of the 45° sector that lies
 * inside the outline (sampled). For narrow houses the sectors mostly fall outside, so a fixed-radius
 * anchor would sit off the plan. Palaces with no interior samples fall back to the centre.
 */
export function palaceAnchors(outline: Point[], northOffset: number, samples = 60): Record<Trigram, PalaceAnchor> {
  const center = polygonCentroid(outline)
  const b = bbox(outline)
  const acc = Object.fromEntries(TRIGRAMS_CLOCKWISE.map((t) => [t, { x: 0, y: 0, n: 0 }])) as Record<Trigram, PalaceAnchor>
  const w = b.maxX - b.minX, h = b.maxY - b.minY
  const nx = Math.max(8, Math.round(samples * (w >= h ? 1 : w / h)))
  const ny = Math.max(8, Math.round(samples * (h >= w ? 1 : h / w)))
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const p = { x: b.minX + ((i + 0.5) / nx) * w, y: b.minY + ((j + 0.5) / ny) * h }
    if (!pointInPolygon(p, outline)) continue
    if (Math.hypot(p.x - center.x, p.y - center.y) < Math.min(w, h) * 0.08) continue // skip the very centre
    const t = palaceOfBearing(bearingOfPoint(center.x, center.y, p.x, p.y, northOffset))
    acc[t].x += p.x; acc[t].y += p.y; acc[t].n += 1
  }
  for (const t of TRIGRAMS_CLOCKWISE) {
    const a = acc[t]
    if (a.n > 0) { a.x /= a.n; a.y /= a.n }
    else { a.x = center.x; a.y = center.y }
  }
  return acc
}
