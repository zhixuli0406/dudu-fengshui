import { describe, expect, it } from 'vitest'
import { headingFromEuler } from './orientation'

describe('headingFromEuler', () => {
  it('平放：heading = 360 − alpha（規範 introduction）', () => {
    expect(headingFromEuler(0, 0, 0).topHeading).toBeCloseTo(0, 6)
    expect(headingFromEuler(90, 0, 0).topHeading).toBeCloseTo(270, 6)
    expect(headingFromEuler(270, 0, 0).topHeading).toBeCloseTo(90, 6)
    expect(headingFromEuler(45, 0, 0).mode).toBe('flat')
  })
  it('平放＋螢幕逆時針轉 90°（landscape-primary）：螢幕上方 = 機頂方位 + 90', () => {
    // 機頂朝西（alpha 90 → 270），螢幕逆時針轉 90 後，螢幕「上」為機身右側 → 指北
    expect(headingFromEuler(90, 0, 0, 90).topHeading).toBeCloseTo(0, 6)
    expect(headingFromEuler(0, 0, 0, 270).topHeading).toBeCloseTo(270, 6)
  })
  it('直立（beta 90）鏡頭朝向 = 方位；不受螢幕旋轉影響', () => {
    const r = headingFromEuler(0, 90, 0)
    expect(r.mode).toBe('upright')
    expect(r.cameraHeading).toBeCloseTo(0, 6)
    expect(headingFromEuler(90, 90, 0).cameraHeading).toBeCloseTo(270, 6)
    expect(headingFromEuler(90, 90, 0, 90).heading).toBeCloseTo(270, 6)
  })
  it('直立時 top 方向近乎指天，flatness ≈ 0', () => {
    expect(headingFromEuler(30, 90, 0).flatness).toBeCloseTo(0, 6)
    expect(headingFromEuler(30, 0, 0).flatness).toBeCloseTo(1, 6)
  })
  it('稍微傾斜（beta 20）仍視為平放且 heading 連續', () => {
    const a = headingFromEuler(120, 0, 0).heading
    const b = headingFromEuler(120, 20, 0).heading
    expect(Math.abs(a - b)).toBeLessThan(1e-6)
  })
})
