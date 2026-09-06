/**
 * Heading filter for noisy compass samples.
 * - Exponential smoothing on the unit circle with a time constant (independent of event rate).
 * - Outlier gate: a sample far from the current estimate is ignored unless it persists for `outlierConfirm` samples
 *   (so a real turn still follows within a few samples, but single spikes do not).
 * - Reports stability (circular std-dev of recent raw samples, degrees).
 */
export interface HeadingFilterOptions {
  /** smoothing time constant in ms (larger = calmer) */
  tauMs?: number
  /** samples deviating more than this (deg) from the estimate are gated */
  outlierDeg?: number
  /** consecutive outliers needed before the estimate jumps to them */
  outlierConfirm?: number
  /** window for the stability estimate */
  window?: number
}

const D2R = Math.PI / 180

export function angleDiff(a: number, b: number): number {
  let d = ((b - a) % 360 + 360) % 360
  if (d > 180) d -= 360
  return d
}

export class HeadingFilter {
  private x = 0
  private y = 0
  private has = false
  private lastT = 0
  private outliers: number[] = []
  private recent: number[] = []
  readonly tauMs: number
  readonly outlierDeg: number
  readonly outlierConfirm: number
  readonly window: number

  constructor(opts: HeadingFilterOptions = {}) {
    this.tauMs = opts.tauMs ?? 500
    this.outlierDeg = opts.outlierDeg ?? 35
    this.outlierConfirm = opts.outlierConfirm ?? 4
    this.window = opts.window ?? 12
  }

  /** Feed a raw heading (deg). Returns the smoothed heading. */
  push(heading: number, t: number): number {
    const h = ((heading % 360) + 360) % 360
    this.recent.push(h)
    if (this.recent.length > this.window) this.recent.shift()
    if (!this.has) { this.x = Math.cos(h * D2R); this.y = Math.sin(h * D2R); this.has = true; this.lastT = t; return h }
    const est = this.value()
    const dev = Math.abs(angleDiff(est, h))
    if (dev > this.outlierDeg) {
      this.outliers.push(h)
      if (this.outliers.length < this.outlierConfirm) { this.lastT = t; return est }
      // persistent: jump to the median of the outlier run
      const m = circularMean(this.outliers)
      this.x = Math.cos(m * D2R); this.y = Math.sin(m * D2R)
      this.outliers = []
      this.lastT = t
      return this.value()
    }
    this.outliers = []
    const dt = Math.max(1, Math.min(500, t - this.lastT))
    this.lastT = t
    const a = 1 - Math.exp(-dt / this.tauMs)
    this.x += (Math.cos(h * D2R) - this.x) * a
    this.y += (Math.sin(h * D2R) - this.y) * a
    return this.value()
  }

  value(): number {
    if (!this.has) return 0
    return ((Math.atan2(this.y, this.x) / D2R) % 360 + 360) % 360
  }

  /** circular std-dev of recent raw samples, degrees */
  stability(): number {
    if (this.recent.length < 3) return 0
    let cx = 0, cy = 0
    for (const h of this.recent) { cx += Math.cos(h * D2R); cy += Math.sin(h * D2R) }
    const R = Math.hypot(cx, cy) / this.recent.length
    return Math.sqrt(Math.max(0, -2 * Math.log(Math.max(1e-9, R)))) / D2R
  }

  reset(): void { this.has = false; this.outliers = []; this.recent = [] }
}

export function circularMean(vals: number[]): number {
  let cx = 0, cy = 0
  for (const h of vals) { cx += Math.cos(h * D2R); cy += Math.sin(h * D2R) }
  return ((Math.atan2(cy, cx) / D2R) % 360 + 360) % 360
}

/** Keep a rotation angle continuous (no 359→0 jump) for CSS transitions. */
export function unwrapAngle(prev: number, next: number): number {
  const target = ((next % 360) + 360) % 360
  const cur = ((prev % 360) + 360) % 360
  return prev + angleDiff(cur, target)
}
