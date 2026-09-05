import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from './bagua'

export function normalizeBearing(deg: number): number {
  const x = deg % 360
  return x < 0 ? x + 360 : x
}

/** Sitting bearing is opposite to facing. */
export function sittingOf(facing: number): number {
  return normalizeBearing(facing + 180)
}

/** Palace (45° sector) that contains a bearing. 坎 = 337.5–22.5 etc. */
export function palaceOfBearing(bearing: number): Trigram {
  const b = normalizeBearing(bearing + 22.5)
  return TRIGRAMS_CLOCKWISE[Math.floor(b / 45) % 8]!
}

/** Smallest signed angle from a to b, in (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = normalizeBearing(b) - normalizeBearing(a)
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

/**
 * Bearing of point (x, y) relative to origin (ox, oy) in a screen-space plan
 * (y grows downward), where `northOffset` is the compass bearing of the plan's "up".
 */
export function bearingOfPoint(ox: number, oy: number, x: number, y: number, northOffset = 0): number {
  const dx = x - ox
  const dy = y - oy
  const screenAngle = (Math.atan2(dx, -dy) * 180) / Math.PI // 0 = up, clockwise
  return normalizeBearing(screenAngle + northOffset)
}

export function palaceZh(p: Trigram): string {
  return `${PALACES[p].zh}（${PALACES[p].direction}）`
}

/** Compass label for a bearing, e.g. 172° → "南 (午)" is produced by callers via mountains24. */
export function cardinalLabel(bearing: number): string {
  return PALACES[palaceOfBearing(bearing)].direction
}
