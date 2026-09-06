import { describe, expect, it } from 'vitest'
import { BUILT_CHOICES, firstStep, isStepId, nextStep, prevStep, progressOf, roomStops, SPINE, type GuideCtx, type StepId } from './script'
import { periodOfYear } from '../engine/xuankong'
import type { Room } from '../engine/floorplan'

const base: GuideCtx = { introSeen: false, hasFacing: false, persons: 0, rooms: [] }
const sq = (x: number, y: number) => [{ x, y }, { x: x + 100, y }, { x: x + 100, y: y + 100 }, { x, y: y + 100 }]
const rooms: Room[] = [{ id: 'k', type: 'kitchen', polygon: sq(0, 0) }, { id: 'l', type: 'living', polygon: sq(200, 0) }, { id: 'm', type: 'master', polygon: sq(0, 200) }]

describe('guide script', () => {
  it('starts with the intro scene once, then goes straight to the door', () => {
    expect(firstStep(base)).toBe('intro')
    expect(firstStep({ ...base, introSeen: true })).toBe('door')
    expect(prevStep('door', { ...base, introSeen: true })).toBeNull()
    expect(isStepId('roomWhere')).toBe(false)
    expect(isStepId('paint')).toBe(true)
  })

  it('walks the spine door → owner → more → built → reveal → size → paint', () => {
    let id: StepId = 'intro'
    const seen: StepId[] = []
    for (let i = 0; i < 7; i++) { id = nextStep(id, base).id; seen.push(id) }
    expect(seen).toEqual(['door', 'owner', 'more', 'built', 'reveal', 'size', 'paint'])
  })

  it('orders rooms master first and knows which ones have a wall question', () => {
    const stops = roomStops(rooms)
    expect(stops.map((s) => s.id)).toEqual(['m', 'k', 'l'])
    expect(stops.map((s) => s.askWall)).toEqual([true, true, true])
    expect(roomStops([{ id: 'e', type: 'entry', polygon: sq(0, 0) }])[0]!.askWall).toBe(false)
  })

  it('after painting, asks the wall then gives the verdict for each room in order, then sums up', () => {
    const ctx: GuideCtx = { ...base, rooms: [{ id: 'm', askWall: true }, { id: 'e', askWall: false }] }
    const a = nextStep('paint', ctx)
    expect(a).toEqual({ id: 'furniture', pendingId: 'm' })
    const b = nextStep('furniture', { ...ctx, pendingId: 'm' })
    expect(b).toEqual({ id: 'roomVerdict', pendingId: 'm' })
    const c = nextStep('roomVerdict', { ...ctx, pendingId: 'm' })
    expect(c).toEqual({ id: 'roomVerdict', pendingId: 'e' })
    expect(nextStep('roomVerdict', { ...ctx, pendingId: 'e' })).toEqual({ id: 'summary' })
    expect(nextStep('paint', { ...base, rooms: [] })).toEqual({ id: 'summary' })
  })

  it('back arrow retraces the room loop', () => {
    const ctx: GuideCtx = { ...base, rooms: [{ id: 'm', askWall: true }, { id: 'e', askWall: false }] }
    expect(prevStep('furniture', { ...ctx, pendingId: 'm' })).toEqual({ id: 'paint' })
    expect(prevStep('roomVerdict', { ...ctx, pendingId: 'm' })).toEqual({ id: 'furniture', pendingId: 'm' })
    expect(prevStep('roomVerdict', { ...ctx, pendingId: 'e' })).toEqual({ id: 'roomVerdict', pendingId: 'm' })
    expect(prevStep('summary', ctx)).toEqual({ id: 'roomVerdict', pendingId: 'e' })
    expect(prevStep('summary', { ...base, rooms: [] })).toEqual({ id: 'paint' })
    expect(prevStep('paint', ctx)).toEqual({ id: 'size' })
    expect(prevStep('size', ctx)).toEqual({ id: 'reveal' })
  })

  it('progress counter stays within the spine', () => {
    for (const id of SPINE) { const p = progressOf(id); expect(p.n).toBeGreaterThan(0); expect(p.n).toBeLessThanOrEqual(p.total) }
    expect(progressOf('intro').n).toBe(0)
    expect(progressOf('roomVerdict').n).toBe(SPINE.length)
    expect(progressOf('summary').n).toBe(SPINE.length)
  })

  it('build-year buckets map to distinct periods', () => {
    expect(BUILT_CHOICES.map((c) => periodOfYear(c.year))).toEqual([9, 8, 7, 6])
  })
})
