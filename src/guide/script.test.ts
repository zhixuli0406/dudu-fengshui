import { describe, expect, it } from 'vitest'
import { BUILT_CHOICES, firstStep, floorSource, isStepId, nextStep, prevStep, progressOf, roomStops, SPINE, type GuideCtx, type StepId } from './script'
import { periodOfYear } from '../engine/xuankong'
import type { Room } from '../engine/floorplan'

const base: GuideCtx = { introSeen: false, hasFacing: false, persons: 0, arAvailable: false, floorCount: 1, floorIdx: 0, floorRooms: [[]], floorSources: ['none'] }
const sq = (x: number, y: number) => [{ x, y }, { x: x + 100, y }, { x: x + 100, y: y + 100 }, { x, y: y + 100 }]
const rooms: Room[] = [{ id: 'k', type: 'kitchen', polygon: sq(0, 0) }, { id: 'l', type: 'living', polygon: sq(200, 0) }, { id: 'm', type: 'master', polygon: sq(0, 200) }]

describe('guide script', () => {
  it('starts with the intro scene once, then asks the home type', () => {
    expect(firstStep(base)).toBe('intro')
    expect(firstStep({ ...base, introSeen: true })).toBe('home')
    expect(prevStep('home', { ...base, introSeen: true })).toBeNull()
    expect(isStepId('roomWhere')).toBe(false)
    expect(isStepId('walk')).toBe(true)
  })

  it('walks the spine and goes straight to the sketch when AR is unavailable', () => {
    let id: StepId = 'intro'
    const seen: StepId[] = []
    for (let i = 0; i < 8; i++) { id = nextStep(id, base).id; seen.push(id) }
    expect(seen).toEqual(['home', 'door', 'owner', 'more', 'built', 'reveal', 'size', 'paint'])
  })

  it('offers the AR / sketch choice when AR is available', () => {
    const ctx = { ...base, arAvailable: true }
    expect(nextStep('reveal', ctx)).toEqual({ id: 'build', floorIdx: 0 })
    expect(nextStep('build', ctx)).toEqual({ id: 'size', floorIdx: 0 })
    expect(prevStep('walk', ctx)).toEqual({ id: 'build', floorIdx: 0 })
    expect(prevStep('size', ctx)).toEqual({ id: 'build', floorIdx: 0 })
  })

  it('orders rooms master first and only asks the wall when the key piece is missing', () => {
    const stops = roomStops({ rooms, items: [{ id: 'b', type: 'bed', x: 0, y: 0, w: 1, h: 1, facing: 0, roomId: 'm' }] })
    expect(stops.map((s) => s.id)).toEqual(['m', 'k', 'l'])
    expect(stops.map((s) => s.askWall)).toEqual([false, true, true])
    expect(roomStops({ rooms: [{ id: 'e', type: 'entry', polygon: sq(0, 0) }], items: [] })[0]!.askWall).toBe(false)
  })

  it('after building, asks the wall then gives the verdict for each room, then sums up', () => {
    const ctx: GuideCtx = { ...base, floorRooms: [[{ id: 'm', askWall: true }, { id: 'e', askWall: false }]], floorSources: ['sketch'] }
    expect(nextStep('paint', ctx)).toEqual({ id: 'furniture', pendingId: 'm', floorIdx: 0 })
    expect(nextStep('walk', ctx)).toEqual({ id: 'furniture', pendingId: 'm', floorIdx: 0 })
    expect(nextStep('furniture', { ...ctx, pendingId: 'm' })).toEqual({ id: 'roomVerdict', pendingId: 'm', floorIdx: 0 })
    expect(nextStep('roomVerdict', { ...ctx, pendingId: 'm' })).toEqual({ id: 'roomVerdict', pendingId: 'e', floorIdx: 0 })
    expect(nextStep('roomVerdict', { ...ctx, pendingId: 'e' })).toEqual({ id: 'summary' })
    expect(nextStep('paint', base)).toEqual({ id: 'summary' })
  })

  it('goes upstairs between floors and comes back down the same way', () => {
    const ctx: GuideCtx = { ...base, floorCount: 2, floorRooms: [[{ id: 'm', askWall: false }], [{ id: 'u', askWall: false }]], floorSources: ['sketch', 'sketch'] }
    expect(nextStep('roomVerdict', { ...ctx, pendingId: 'm' })).toEqual({ id: 'upstairs', floorIdx: 0 })
    expect(nextStep('upstairs', ctx)).toEqual({ id: 'size', floorIdx: 1 })
    expect(nextStep('roomVerdict', { ...ctx, floorIdx: 1, pendingId: 'u' })).toEqual({ id: 'summary' })
    expect(prevStep('size', { ...ctx, floorIdx: 1 })).toEqual({ id: 'upstairs', floorIdx: 0 })
    expect(prevStep('upstairs', ctx)).toEqual({ id: 'roomVerdict', pendingId: 'm', floorIdx: 0 })
    expect(prevStep('summary', ctx)).toEqual({ id: 'roomVerdict', pendingId: 'u', floorIdx: 1 })
    expect(prevStep('roomVerdict', { ...ctx, floorIdx: 1, pendingId: 'u' })).toEqual({ id: 'paint', floorIdx: 1 })
  })

  it('back from the first room depends on how the floor was built', () => {
    const rs = [[{ id: 'm', askWall: true }]]
    expect(prevStep('furniture', { ...base, pendingId: 'm', floorRooms: rs, floorSources: ['sketch'] })).toEqual({ id: 'paint', floorIdx: 0 })
    expect(prevStep('furniture', { ...base, pendingId: 'm', floorRooms: rs, floorSources: ['ar'], arAvailable: true })).toEqual({ id: 'build', floorIdx: 0 })
    expect(prevStep('furniture', { ...base, pendingId: 'm', floorRooms: rs, floorSources: ['other'] })).toEqual({ id: 'size', floorIdx: 0 })
  })

  it('tells sketch, AR and hand-drawn floors apart', () => {
    expect(floorSource({ outline: sq(0, 0), rooms: [{ id: 'wz_r0', type: 'living', polygon: sq(0, 0) }] })).toBe('sketch')
    expect(floorSource({ outline: sq(0, 0), rooms: [{ id: 'r_ar_0', type: 'living', polygon: sq(0, 0) }] })).toBe('ar')
    expect(floorSource({ outline: sq(0, 0), rooms: [{ id: 'r_x', type: 'living', polygon: sq(0, 0) }] })).toBe('other')
    expect(floorSource(undefined)).toBe('none')
  })

  it('progress counter stays within the spine', () => {
    for (const id of SPINE) { const p = progressOf(id); expect(p.n).toBeGreaterThan(0); expect(p.n).toBeLessThanOrEqual(p.total) }
    expect(progressOf('intro').n).toBe(0)
    expect(progressOf('summary').n).toBe(SPINE.length)
  })

  it('build-year buckets map to distinct periods', () => {
    expect(BUILT_CHOICES.map((c) => periodOfYear(c.year))).toEqual([9, 8, 7, 6])
  })
})
