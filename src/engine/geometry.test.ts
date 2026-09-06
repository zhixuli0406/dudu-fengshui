import { describe, expect, it } from 'vitest'
import { polygonArea, polygonCentroid, pointInPolygon, segmentsIntersect, segmentCrossesPolygonEdges, rectCorners, screenAngle, distToSegment } from './geometry'

const sq = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]

describe('geometry', () => {
  it('area / centroid', () => {
    expect(polygonArea(sq)).toBe(10000)
    expect(polygonCentroid(sq)).toEqual({ x: 50, y: 50 })
    const L = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 100 }]
    const c = polygonCentroid(L)
    expect(c.x).toBeLessThan(50); expect(c.y).toBeLessThan(50)
  })
  it('point in polygon', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, sq)).toBe(true)
    expect(pointInPolygon({ x: 150, y: 50 }, sq)).toBe(false)
  })
  it('segments', () => {
    expect(segmentsIntersect({ a: { x: 0, y: 0 }, b: { x: 10, y: 10 } }, { a: { x: 0, y: 10 }, b: { x: 10, y: 0 } })).toBe(true)
    expect(segmentsIntersect({ a: { x: 0, y: 0 }, b: { x: 10, y: 0 } }, { a: { x: 0, y: 5 }, b: { x: 10, y: 5 } })).toBe(false)
    expect(distToSegment({ x: 5, y: 5 }, { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } })).toBe(5)
  })
  it('line of sight through walls ignores endpoints on walls', () => {
    // door on the top wall at (50,0) to window on bottom wall (50,100): should not count as crossing
    expect(segmentCrossesPolygonEdges({ a: { x: 50, y: 0 }, b: { x: 50, y: 100 } }, sq)).toBe(false)
    // a line from outside crossing the polygon
    expect(segmentCrossesPolygonEdges({ a: { x: -50, y: 50 }, b: { x: 150, y: 50 } }, sq)).toBe(true)
  })
  it('rect corners use facing when rotation is absent (items)', () => {
    const c = rectCorners({ x: 0, y: 0, w: 200, h: 100, facing: 90 })
    const xs = c.map((p) => p.x), ys = c.map((p) => p.y)
    expect(Math.round(Math.max(...xs) - Math.min(...xs))).toBe(100)
    expect(Math.round(Math.max(...ys) - Math.min(...ys))).toBe(200)
  })
  it('rect corners rotated', () => {
    const c = rectCorners({ x: 0, y: 0, w: 10, h: 10, rotation: 90 })
    expect(Math.round(c[0]!.x)).toBe(10); expect(Math.abs(Math.round(c[0]!.y))).toBe(0)
  })
  it('screenAngle', () => {
    expect(screenAngle({ x: 0, y: 0 }, { x: 0, y: -1 })).toBe(0)
    expect(screenAngle({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(90)
  })
})
