import { describe, expect, it } from 'vitest'
import { BUILT_CHOICES, firstStep, nextStep, pendingRoomType, prevStep, progressOf, roomMenu, SPINE, type GuideCtx, type StepId } from './script'
import { periodOfYear } from '../engine/xuankong'

const base: GuideCtx = { introSeen: false, hasFacing: false, persons: 0, rooms: [] }

describe('guide script', () => {
  it('starts with the intro scene once, then goes straight to the door', () => {
    expect(firstStep(base)).toBe('intro')
    expect(firstStep({ ...base, introSeen: true })).toBe('door')
    expect(prevStep('door', { ...base, introSeen: true })).toBeNull()
  })

  it('walks the spine door → owner → more → built → reveal', () => {
    let id: StepId = 'intro'
    const seen: StepId[] = []
    for (let i = 0; i < 5; i++) { id = nextStep(id, base); seen.push(id) }
    expect(seen).toEqual(['door', 'owner', 'more', 'built', 'reveal'])
  })

  it('asks about the master bedroom first, then its bed head, then the verdict', () => {
    const ctx = { ...base, hasFacing: true, persons: 1 }
    expect(pendingRoomType(ctx)).toBe('master')
    expect(nextStep('reveal', ctx)).toBe('roomWhere')
    const withPending = { ...ctx, pendingType: 'master' as const, pendingId: 'r1' }
    expect(nextStep('roomWhere', withPending)).toBe('roomFacing')
    expect(nextStep('roomFacing', withPending)).toBe('roomVerdict')
    expect(nextStep('roomVerdict', withPending)).toBe('roomType')
  })

  it('skips the facing question for rooms without a key facing (bathroom, living)', () => {
    const ctx = { ...base, pendingType: 'bathroom' as const, pendingId: 'r2', rooms: [{ id: 'r1', type: 'master' as const, palace: 'kan' as const }] }
    expect(nextStep('roomWhere', ctx)).toBe('roomVerdict')
    expect(prevStep('roomVerdict', ctx)).toBe('roomWhere')
  })

  it('loops on roomType until the user stops', () => {
    const rooms = [{ id: 'r1', type: 'master' as const, palace: 'kan' as const }]
    expect(nextStep('roomType', { ...base, rooms, pendingType: 'kitchen' })).toBe('roomWhere')
    expect(nextStep('roomType', { ...base, rooms })).toBe('summary')
    expect(nextStep('reveal', { ...base, rooms })).toBe('roomType')
    expect(pendingRoomType({ ...base, rooms })).toBeUndefined()
  })

  it('back arrow retraces every forward edge', () => {
    const rooms = [{ id: 'r1', type: 'master' as const, palace: 'kan' as const }]
    const ctx: GuideCtx = { ...base, rooms, pendingType: 'master', pendingId: 'r1' }
    for (const [from, to] of [['owner', 'door'], ['more', 'owner'], ['built', 'more'], ['reveal', 'built'], ['roomFacing', 'roomWhere'], ['roomVerdict', 'roomFacing'], ['roomType', 'roomVerdict'], ['summary', 'roomType']] as [StepId, StepId][]) {
      expect(prevStep(from, ctx)).toBe(to)
    }
    expect(prevStep('roomWhere', { ...base, rooms: [] })).toBe('reveal')
    expect(prevStep('roomType', { ...base, rooms: [] })).toBe('reveal')
  })

  it('progress counter stays within the spine', () => {
    for (const id of SPINE) { const p = progressOf(id); expect(p.n).toBeGreaterThan(0); expect(p.n).toBeLessThanOrEqual(p.total) }
    expect(progressOf('intro').n).toBe(0)
    expect(progressOf('summary').n).toBe(SPINE.length)
  })

  it('build-year buckets map to distinct periods', () => {
    expect(BUILT_CHOICES.map((c) => periodOfYear(c.year))).toEqual([9, 8, 7, 6])
  })

  it('room menu offers each type once but allows extra bedrooms', () => {
    const menu = roomMenu([{ id: 'a', type: 'master', palace: 'kan' }, { id: 'b', type: 'bedroom', palace: 'li' }])
    expect(menu).not.toContain('master')
    expect(menu).toContain('bedroom')
    expect(menu).toContain('kitchen')
  })
})
