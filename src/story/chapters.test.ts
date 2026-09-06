import { describe, expect, it } from 'vitest'
import { buildChapters } from './chapters'
import { buildReport } from '../engine/report'
import { demoPlan } from '../data/demoPlan'

describe('story chapters', () => {
  const plan = demoPlan()
  const report = buildReport([{ id: 'p', name: '阿明', birthDate: '1990-05-01', gender: 'male', primary: true }], { facingBearing: 180, periodYear: 2020, plan }, new Date('2026-09-06T12:00:00'))
  it('builds cover, door, one chapter per room, annual, wealth, summary', () => {
    const ch = buildChapters(report, plan)
    expect(ch[0]!.id).toBe('cover')
    expect(ch[1]!.id).toBe('door')
    expect(ch.filter((c) => c.id.startsWith('room_'))).toHaveLength(plan.rooms.length)
    expect(ch.at(-3)!.id).toBe('annual')
    expect(ch.at(-2)!.id).toBe('wealth')
    expect(ch.at(-1)!.id).toBe('summary')
    for (const c of ch) { expect(c.paragraphs.length).toBeGreaterThan(0); expect(c.bubble.length).toBeGreaterThan(0); for (const p of c.paragraphs) expect(p).not.toMatch(/undefined|NaN/) }
    expect(ch[0]!.paragraphs.join('')).toContain('阿明')
    expect(ch.find((c) => c.label === '主臥')!.paragraphs.join('')).toMatch(/床/)
  })
  it('no AI-writing tells in narrative', () => {
    const text = buildChapters(report, plan).flatMap((c) => [...c.paragraphs, c.bubble]).join('\n')
    expect(text).not.toMatch(/不是.{1,12}而是/)
    expect(text).not.toContain('——')
  })
})
