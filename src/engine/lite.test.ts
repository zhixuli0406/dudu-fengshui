import { describe, expect, it } from 'vitest'
import { synthesizePlan } from './lite'
import { buildReport } from './report'
import { buildContext } from './rules'

describe('lite synthesis', () => {
  it('places door on the facing side and rooms in their palace cells; report runs without form rules', () => {
    const plan = synthesizePlan(180, [
      { id: 'm', type: 'master', palace: 'xun', facing: 'zhen' },
      { id: 'k', type: 'kitchen', palace: 'qian', facing: 'li' },
      { id: 'b', type: 'bathroom', palace: 'kan' },
    ])
    expect(plan.synthetic).toBe(true)
    const ctx = buildContext(plan)
    const door = plan.items.find((i) => i.type === 'mainDoor')!
    expect(ctx.palaceOfItem(door)).toBe('li')
    const bed = plan.items.find((i) => i.type === 'bed')!
    expect(ctx.palaceOfItem(bed)).toBe('xun')
    expect(bed.facing).toBe(90)
    const r = buildReport([{ id: 'p', name: '阿明', birthDate: '1990-05-01', gender: 'male', primary: true }], { facingBearing: 180, periodYear: 2020, plan }, new Date('2026-09-06T12:00:00'))
    expect(r.form.findings).toEqual([])
    expect(r.bazhai.items.some((i) => i.itemType === 'bed')).toBe(true)
    expect(r.bazhai.items.find((i) => i.itemType === 'mainDoor')!.palace).toBe('li')
    expect(r.scores.overall).toBeGreaterThan(0)
  })
  it('door lands on every side correctly', () => {
    for (const [bearing, pal] of [[0, 'kan'], [90, 'zhen'], [270, 'dui'], [45, 'gen'], [315, 'qian'], [225, 'kun'], [135, 'xun']] as const) {
      const plan = synthesizePlan(bearing, [])
      const ctx = buildContext(plan)
      expect(ctx.palaceOfItem(plan.items[0]!)).toBe(pal)
    }
  })
})
