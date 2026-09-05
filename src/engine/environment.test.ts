import { describe, expect, it } from 'vitest'
import { environmentFindings, isPositiveAnswer, type EnvironmentQuestion } from './environment'
import questions from '../data/environmentQuestions.json'

const QS = questions as EnvironmentQuestion[]

describe('外局問卷', () => {
  it('題庫已載入且有選項', () => {
    expect(QS.length).toBeGreaterThanOrEqual(30)
    for (const q of QS) { expect(q.id).toMatch(/^[a-z0-9_]+$/); expect(q.options.length).toBeGreaterThanOrEqual(2) }
  })
  it('否定選項不產生 finding', () => {
    expect(isPositiveAnswer('無')).toBe(false)
    expect(isPositiveAnswer('不確定')).toBe(false)
    expect(isPositiveAnswer('內側（玉帶環腰．吉）')).toBe(false)
    expect(isPositiveAnswer('正前方')).toBe(true)
  })
  it('路沖 → 高嚴重度 finding', () => {
    const f = environmentFindings({ road_rush: '正前方' }, QS)
    expect(f).toHaveLength(1)
    expect(f[0]!.ruleId).toBe('env_road_rush')
    expect(f[0]!.severity).toBe('high')
    expect(f[0]!.remedies.length).toBeGreaterThan(0)
  })
  it('未作答／否定 → 無 finding', () => {
    expect(environmentFindings({}, QS)).toEqual([])
    expect(environmentFindings({ road_rush: '無' }, QS)).toEqual([])
  })
})
