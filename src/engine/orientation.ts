/**
 * Compass heading from DeviceOrientation Euler angles (W3C intrinsic Z-X'-Y'' convention).
 * World frame: X east, Y north, Z up. Device frame: X right, Y top, Z out of screen.
 *
 * - `topHeading`: bearing of the device's top edge projected on the ground (valid when the phone is flat).
 *   Flat with β=γ=0 reduces to 360 − α, as the spec's introduction states.
 * - `cameraHeading`: bearing of the rear camera direction (valid when the phone is upright).
 * - `screenAngle` (screen.orientation.angle, CCW from natural) is added to the top heading so the value
 *   refers to what the user sees as "up" on screen; camera heading is unaffected by UI rotation.
 */
export interface EulerHeading {
  topHeading: number
  cameraHeading: number
  /** cos(angle between screen normal and world up); ≈1 flat face-up, ≈0 upright */
  flatness: number
  /** chosen heading: top (flat) or camera (upright) */
  heading: number
  mode: 'flat' | 'upright'
}

const D2R = Math.PI / 180

export function headingFromEuler(alpha: number, beta: number, gamma: number, screenAngle = 0): EulerHeading {
  const cX = Math.cos(beta * D2R), sX = Math.sin(beta * D2R)
  const cY = Math.cos(gamma * D2R), sY = Math.sin(gamma * D2R)
  const cZ = Math.cos(alpha * D2R), sZ = Math.sin(alpha * D2R)
  // rotation matrix R (device → world) per W3C DeviceOrientation spec
  const m12 = -cX * sZ
  const m22 = cZ * cX
  const m32 = sX
  const m13 = cY * sZ * sX + cZ * sY
  const m23 = sZ * sY - cZ * cY * sX
  const m33 = cX * cY
  void m32
  const norm = (d: number) => ((d % 360) + 360) % 360
  const topHeading = norm((Math.atan2(m12, m22) * 180) / Math.PI + screenAngle)
  const cameraHeading = norm((Math.atan2(-m13, -m23) * 180) / Math.PI)
  const flatness = Math.abs(m33)
  const mode: EulerHeading['mode'] = flatness > Math.SQRT1_2 ? 'flat' : 'upright'
  return { topHeading, cameraHeading, flatness, heading: mode === 'flat' ? topHeading : cameraHeading, mode }
}

/** Screen rotation angle (CCW from natural orientation), with legacy window.orientation fallback. */
export function currentScreenAngle(): number {
  if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle
  const w = typeof window !== 'undefined' ? (window as unknown as { orientation?: number }).orientation : undefined
  return typeof w === 'number' ? ((w % 360) + 360) % 360 : 0
}
