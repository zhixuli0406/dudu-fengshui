import { describe, expect, it } from 'vitest'
import { buildReportSvg, buildShareSvg } from './shareCard'
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
    expect(buildShareSvg({ kind: 'palace', plan, report })).toContain('財位')
    expect(buildShareSvg({ kind: 'palace', plan, report })).toContain('文昌')
  })
  it('full report image contains every section', () => {
    const { svg, height } = buildReportSvg({ kind: 'annual', plan, report })
    expect(height).toBeGreaterThan(2000)
    for (const t of ['嘟嘟風水分析報告', '優先處理', '成員命卦', '飛星盤', '流年', '形勢問題', '阿明']) expect(svg).toContain(t)
    expect(svg.endsWith('</svg>')).toBe(true)
  })
  it('escapes text', () => {
    const p2 = { ...plan, rooms: [{ ...plan.rooms[0]!, name: 'A<B&C' }, ...plan.rooms.slice(1)] }
    expect(buildShareSvg({ kind: 'palace', plan: p2, report })).toContain('A&lt;B&amp;C')
  })
})
