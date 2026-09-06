import { describe, expect, it } from 'vitest'
import { cellsToRooms, doorOnWall, gridCells, outlineFromDims, placeAgainstWall, unionCells } from './wizard'
import { polygonArea } from './geometry'

describe('wizard helpers', () => {
  it('outline from dims (rect and L)', () => {
    expect(outlineFromDims(10, 8)).toEqual([{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 800 }, { x: 0, y: 800 }])
    const L = outlineFromDims(10, 8, 'L', 'tr', 3, 2)
    expect(L).toHaveLength(6)
    expect(polygonArea(L)).toBe(1000 * 800 - 300 * 200)
  })
  it('door on wall faces inward', () => {
    const o = outlineFromDims(10, 8)
    const d = doorOnWall(o, 'top', 0.5)
    expect(d.facing).toBe(180)
    expect(d.x + d.w / 2).toBe(500)
    expect(d.y + d.h / 2).toBe(0)
    const l = doorOnWall(o, 'left', 0.25)
    expect(l.facing).toBe(90)
    expect(l.y + l.h / 2).toBe(200)
  })
  it('grid cells respect an L outline', () => {
    const L = outlineFromDims(10, 8, 'L', 'tr', 5, 4)
    const cells = gridCells(L, 4, 4)
    expect(cells).toHaveLength(16 - 4)
  })
  it('union of painted cells forms one polygon; disjoint groups become separate rooms', () => {
    const o = outlineFromDims(8, 6)
    const cells = gridCells(o, 4, 3)
    const poly = unionCells(cells.filter((c) => c.row === 0 && c.col <= 1))
    expect(poly).toEqual([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 200 }, { x: 0, y: 200 }])
    const Lcells = cells.filter((c) => (c.row === 0 && c.col <= 1) || (c.row === 1 && c.col === 0))
    expect(unionCells(Lcells)).toHaveLength(6)
    const rooms = cellsToRooms(cells, { '0,0': 'living', '1,0': 'living', '3,2': 'bathroom', '0,2': 'bedroom', '1,2': 'bedroom' })
    expect(rooms).toHaveLength(3)
    expect(rooms.find((r) => r.type === 'living')!.polygon).toHaveLength(4)
  })
  it('places key items against walls with the right facing', () => {
    const room = { id: 'r', type: 'master' as const, polygon: outlineFromDims(4, 3) }
    const bed = placeAgainstWall(room, 'bed', 'top')
    expect(bed.facing).toBe(0)
    expect(bed.y).toBe(5)
    const bedR = placeAgainstWall(room, 'bed', 'right')
    expect(bedR.facing).toBe(90)
    expect(bedR.x + bedR.w / 2).toBe(400 - 200 / 2 - 5)
    const stove = placeAgainstWall({ ...room, type: 'kitchen' }, 'stove', 'bottom')
    expect(stove.facing).toBe(0)
    expect(stove.y + stove.h).toBe(295)
  })
})
