import { describe, expect, it } from 'vitest'
import { buildShareSvg } from './shareCard'
import { buildReport } from '../engine/report'
import { demoPlan } from '../data/demoPlan'

describe('share card', () => {
  const plan = demoPlan()
  const report = buildReport([{ id: 'p', name: '阿明', birthDate: '1990-05-01', gender: 'male', primary: true }], { facingBearing: 180, periodYear: 2020, plan }, new Date('2026-09-06T12:00:00'))
  it('renders each layer as valid SVG with key content', () => {
    for (const kind of ['palace', 'bazhai', 'stars', 'annual', 'form'] as const) {
      const svg = buildShareSvg({ kind, plan, report })
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg.endsWith('</svg>')).toBe(true)
      expect(svg).toContain('嘟嘟風水')
      expect(svg).toContain(String(report.scores.overall))
      expect(svg).toContain('主臥')
    }
    expect(buildShareSvg({ kind: 'bazhai', plan, report })).toContain('阿明')
    expect(buildShareSvg({ kind: 'form', plan, report })).toContain('偵測到')
    expect(buildShareSvg({ kind: 'annual', plan, report })).toContain('五黃')
  })
  it('escapes text', () => {
    const p2 = { ...plan, rooms: [{ ...plan.rooms[0]!, name: 'A<B&C' }, ...plan.rooms.slice(1)] }
    expect(buildShareSvg({ kind: 'palace', plan: p2, report })).toContain('A&lt;B&amp;C')
  })
})
