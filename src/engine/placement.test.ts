import { describe, expect, it } from 'vitest'
import { edgeBearing, edgeDirectionZh, nearestEdge, placeAtWall } from './placement'
import type { Room } from './floorplan'

const square: Room = { id: 'r', type: 'master', polygon: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }] }
// the same square turned 45°: a diamond with its top vertex at (200, -83)
const s = Math.SQRT1_2
const rot = (p: { x: number; y: number }) => ({ x: 200 + (p.x - 200) * s - (p.y - 200) * s, y: 200 + (p.x - 200) * s + (p.y - 200) * s })
const diamond: Room = { id: 'd', type: 'bedroom', polygon: square.polygon.map(rot) }

describe('nearestEdge', () => {
  it('finds the closest wall and orients the normal into the room', () => {
    const hit = nearestEdge(square.polygon, { x: 100, y: 30 })!
    expect(hit.i).toBe(0)
    expect(hit.q).toEqual({ x: 100, y: 0 })
    expect(hit.inward).toEqual({ x: -0, y: 1 })
    const right = nearestEdge(square.polygon, { x: 380, y: 250 })!
    expect(right.i).toBe(1)
    expect(right.inward.x).toBeCloseTo(-1)
  })
})

describe('placeAtWall', () => {
  it('puts a bed with its head against the tapped wall', () => {
    const bed = placeAtWall(square, 'bed', { x: 100, y: 30 })!
    expect(bed.facing).toBe(0) // head toward the top wall
    expect(bed.y).toBe(5) // just off the wall
    expect(bed.x + bed.w / 2).toBe(100)
    expect(bed.roomId).toBe('r')
    expect(placeAtWall(square, 'bed', { x: 380, y: 250 })!.facing).toBe(90)
  })

  it('puts a stove with its back to the wall so the cook faces the room', () => {
    expect(placeAtWall(square, 'stove', { x: 380, y: 250 })!.facing).toBe(270)
    expect(placeAtWall(square, 'sofa', { x: 200, y: 390 })!.facing).toBe(0)
  })

  it('handles a rotated room with an exact angle, not a quarter turn', () => {
    // tap near the upper-right edge of the diamond (the square's original top wall, turned 45° clockwise)
    const mid = rot({ x: 200, y: 10 })
    const bed = placeAtWall(diamond, 'bed', mid)!
    expect(bed.facing).toBe(45)
    expect(bed.edge.i).toBe(0)
  })
})

describe('edgeBearing', () => {
  it('names each wall by the compass direction its outside faces', () => {
    expect(edgeBearing(square.polygon, 0, 0)).toBe(0)
    expect(edgeBearing(square.polygon, 1, 0)).toBe(90)
    expect(edgeBearing(square.polygon, 2, 0)).toBe(180)
    expect(edgeBearing(square.polygon, 3, 0)).toBe(270)
    expect(edgeDirectionZh(square.polygon, 0, 230)).toBe('西南')
    expect(edgeDirectionZh(diamond.polygon, 0, 0)).toBe('東北')
  })
})
