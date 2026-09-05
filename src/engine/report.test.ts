import { describe, expect, it } from 'vitest'
import { buildReport } from './report'
import type { FloorPlan } from './floorplan'

const rect = (x: number, y: number, w: number, h: number) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]

describe('report', () => {
  const plan: FloorPlan = {
    outline: rect(0, 0, 800, 600),
    rooms: [
      { id: 'living', type: 'living', polygon: rect(0, 0, 500, 600) },
      { id: 'bed', type: 'master', polygon: rect(500, 0, 300, 300) },
      { id: 'kitchen', type: 'kitchen', polygon: rect(500, 450, 300, 150) },
    ],
    items: [
      { id: 'm', type: 'mainDoor', x: 355, y: -5, w: 90, h: 10, facing: 180 },
      { id: 'b', type: 'bed', x: 600, y: 0, w: 150, h: 200, facing: 0, roomId: 'bed' },
      { id: 's', type: 'stove', x: 700, y: 545, w: 75, h: 50, facing: 0, roomId: 'kitchen' },
    ],
    northOffset: 0,
    gridCm: 50,
  }
  it('builds a full report', () => {
    const r = buildReport(
      [{ id: 'p1', name: '阿明', birthDate: '1990-05-01', gender: 'male', primary: true }, { id: 'p2', name: '小美', birthDate: '1992-03-10', gender: 'female' }],
      { facingBearing: 180, periodYear: 2020, plan },
      new Date('2026-09-05T12:00:00'),
    )
    expect(r.year).toBe(2026)
    expect(r.ganzhi).toBe('丙午')
    expect(r.period).toBe(8)
    expect(r.house.facing.name).toBe('午')
    expect(r.house.sitting.name).toBe('子')
    expect(r.house.houseGua).toBe('kan')
    expect(r.persons[0]!.gua).toBe('kan')
    expect(r.persons[0]!.compatible).toBe(true)
    expect(r.persons[1]!.gua).toBe('dui')
    expect(r.persons[1]!.compatible).toBe(false)
    expect(r.xuankong.patternZh).toBe('雙星到向')
    expect(r.bazhai.items.length).toBeGreaterThanOrEqual(4)
    expect(r.annual.data.wuhuang).toBe('li')
    expect(r.scores.overall).toBeGreaterThan(0)
    expect(r.scores.overall).toBeLessThanOrEqual(100)
    expect(r.elementAdvice).toHaveLength(8)
    // main door is north (top), facing bearing 180 => door palace 坎
    const md = r.bazhai.items.find((i) => i.itemType === 'mainDoor')!
    expect(md.palace).toBe('kan')
    expect(md.perPerson[0]!.star).toBe('fuwei')
  })
  it('works with empty plan', () => {
    const r = buildReport([], { facingBearing: 90, periodYear: 2025, plan: { outline: [], rooms: [], items: [], northOffset: 0, gridCm: 50 } })
    expect(r.period).toBe(9)
    expect(r.form.findings).toEqual([])
    expect(r.scores.overall).toBeGreaterThan(0)
  })
})
