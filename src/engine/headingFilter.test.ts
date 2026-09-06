import { describe, expect, it } from 'vitest'
import { HeadingFilter, angleDiff, unwrapAngle } from './headingFilter'

describe('HeadingFilter', () => {
  it('ignores single spikes and follows persistent turns', () => {
    const f = new HeadingFilter({ tauMs: 300, outlierDeg: 35, outlierConfirm: 4 })
    let t = 0
    for (let i = 0; i < 30; i++) f.push(160 + (i % 2 ? 2 : -2), (t += 16))
    expect(Math.abs(angleDiff(f.value(), 160))).toBeLessThan(3)
    // a single 60° spike (the bug seen in the video) must not move the estimate
    f.push(120, (t += 16))
    expect(Math.abs(angleDiff(f.value(), 160))).toBeLessThan(3)
    // alternating two sources 160 / 120 would previously oscillate; now stays near 160 while the second source is sparse
    for (let i = 0; i < 6; i++) { f.push(160, (t += 16)); f.push(120, (t += 16)) }
    expect(Math.abs(angleDiff(f.value(), 160))).toBeLessThan(5)
    // a real turn to 100° persists → estimate jumps after outlierConfirm samples
    for (let i = 0; i < 6; i++) f.push(100, (t += 16))
    expect(Math.abs(angleDiff(f.value(), 100))).toBeLessThan(5)
  })
  it('smooths with a time constant, wraps around 0/360', () => {
    const f = new HeadingFilter({ tauMs: 200, outlierDeg: 60 })
    let t = 0
    f.push(350, t)
    for (let i = 0; i < 40; i++) f.push(10, (t += 20))
    expect(Math.abs(angleDiff(f.value(), 10))).toBeLessThan(2)
  })
  it('stability reflects sample spread', () => {
    const calm = new HeadingFilter(); const noisy = new HeadingFilter()
    for (let i = 0; i < 12; i++) { calm.push(90 + (i % 2), i * 16); noisy.push(i % 2 ? 60 : 120, i * 16) }
    expect(calm.stability()).toBeLessThan(2)
    expect(noisy.stability()).toBeGreaterThan(20)
  })
  it('unwrapAngle keeps rotation continuous', () => {
    expect(unwrapAngle(358, 2)).toBe(362)
    expect(unwrapAngle(362, 358)).toBe(358)
    expect(unwrapAngle(-5, 350)).toBe(-10)
  })
})
