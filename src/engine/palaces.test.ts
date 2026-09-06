import { describe, expect, it } from 'vitest'
import { palaceAnchors } from './palaces'
import { pointInPolygon } from './geometry'
import { TRIGRAMS_CLOCKWISE } from './bagua'

describe('palaceAnchors', () => {
  it('keeps every anchor inside a narrow tall house', () => {
    const outline = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 900 }, { x: 0, y: 900 }]
    for (const north of [0, 45, 90, 137]) {
      const a = palaceAnchors(outline, north)
      for (const t of TRIGRAMS_CLOCKWISE) expect(pointInPolygon({ x: a[t].x, y: a[t].y }, outline)).toBe(true)
    }
  })
  it('anchors sit in the right direction for a square house with north up', () => {
    const outline = [{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 800 }, { x: 0, y: 800 }]
    const a = palaceAnchors(outline, 0)
    expect(a.kan.y).toBeLessThan(300) // north = up
    expect(a.li.y).toBeGreaterThan(500)
    expect(a.zhen.x).toBeGreaterThan(500) // east = right
    expect(a.dui.x).toBeLessThan(300)
    expect(a.qian.x).toBeLessThan(400); expect(a.qian.y).toBeLessThan(400)
  })
})
