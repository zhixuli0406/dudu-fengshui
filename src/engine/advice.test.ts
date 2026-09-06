import { describe, expect, it } from 'vitest'
import { buildActions, classifyRemedy, groupByEffort, plainSummary } from './advice'
import { buildReport } from './report'
import { demoPlan } from '../data/demoPlan'

describe('advice', () => {
  it('classifies remedies by effort', () => {
    expect(classifyRemedy('廁所門常關並加裝門簾（長度過膝）')).toBe('small')
    expect(classifyRemedy('廁所內保持通風乾燥')).toBe('now')
    expect(classifyRemedy('移動床位離開門的直線')).toBe('move')
    expect(classifyRemedy('調整爐灶位置避開門的直線')).toBe('move')
    expect(classifyRemedy('爐灶改置東、東南（木生火）方位')).toBe('renovate')
    expect(classifyRemedy('大型裝修時考慮移位')).toBe('renovate')
    expect(classifyRemedy('以天花板包樑、間接照明拉平視覺')).toBe('renovate')
  })
  it('builds plain-language actions from the demo report', () => {
    const plan = demoPlan()
    const report = buildReport([{ id: 'p', name: '阿明', birthDate: '1990-05-01', gender: 'male', primary: true }], { facingBearing: 180, periodYear: 2020, plan }, new Date('2026-09-06T12:00:00'))
    const actions = buildActions(report)
    expect(actions.length).toBeGreaterThan(5)
    for (const a of actions) { expect(a.how.length).toBeGreaterThan(0); expect(a.how[0]!.effort).toBe(a.effort); expect(a.title).not.toMatch(/undefined/) }
    const g = groupByEffort(actions)
    expect(g.now.length + g.small.length + g.move.length + g.renovate.length).toBe(actions.length)
    // easiest first
    const order = ['now', 'small', 'move', 'renovate']
    for (let i = 1; i < actions.length; i++) expect(order.indexOf(actions[i]!.effort)).toBeGreaterThanOrEqual(order.indexOf(actions[i - 1]!.effort))
    const s = plainSummary(report, actions)
    expect(s).toContain('阿明')
    expect(s).toContain('坎宅')
    expect(actions.some((a) => a.title.includes('房門正對著床'))).toBe(true)
    expect(actions.some((a) => a.where === 'kitchen' || a.where === 'bathroom')).toBe(false)
  })
})
