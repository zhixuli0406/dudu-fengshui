import type { Room, RoomType } from '../engine/floorplan'
import { keyItemFor } from '../engine/wizard'

/**
 * The guided walk-through ("師傅來看房"): one question per screen in the master's voice, a short
 * scene before, a reveal in the middle, then the house is sketched room by room and each room
 * gets its verdict. This module is the pure state machine; `pages/StartPage.tsx` renders it.
 */
export type StepId =
  | 'intro' // scene: the master arrives at the door
  | 'door' // which way the main door faces (compass)
  | 'owner' // who runs the household (first person)
  | 'more' // anyone else to include
  | 'built' // roughly when the house was built (period)
  | 'reveal' // scene: house gua, wealth / study positions, owner's fit
  | 'size' // how big the house is, seen from the doorway
  | 'paint' // paint rooms onto the sketch
  | 'furniture' // which wall the key piece of one room is against
  | 'roomVerdict' // scene: what the master says about that room
  | 'summary' // scene: score, top to-dos, exits

export const STEP_IDS: StepId[] = ['intro', 'door', 'owner', 'more', 'built', 'reveal', 'size', 'paint', 'furniture', 'roomVerdict', 'summary']
export function isStepId(x: unknown): x is StepId { return typeof x === 'string' && (STEP_IDS as string[]).includes(x) }

/** A room in the order the master walks them, and whether it has a key piece of furniture to ask about. */
export interface RoomStop { id: string; askWall: boolean }

export interface GuideCtx {
  introSeen: boolean
  hasFacing: boolean
  persons: number
  rooms: RoomStop[]
  /** the room currently being asked about / judged */
  pendingId?: string
}

/** Where to go next: a step and, for room steps, which room. */
export interface Move { id: StepId; pendingId?: string }

/** Fixed spine used for the "n / N" counter; the room loop repeats at the tail. */
export const SPINE: StepId[] = ['door', 'owner', 'more', 'built', 'size', 'paint', 'furniture']

export function progressOf(id: StepId): { n: number; total: number } {
  const total = SPINE.length
  const i = SPINE.indexOf(id)
  if (i >= 0) return { n: i + 1, total }
  if (id === 'intro') return { n: 0, total }
  if (id === 'reveal') return { n: 4, total }
  return { n: total, total }
}

export function firstStep(ctx: GuideCtx): StepId {
  return ctx.introSeen ? 'door' : 'intro'
}

/** The order the master walks the rooms: sleeping first, then fire, then the rest. */
export const ROOM_ORDER: RoomType[] = ['master', 'bedroom', 'kids', 'kitchen', 'study', 'bathroom', 'living', 'altar', 'dining', 'entry', 'balcony', 'storage', 'corridor', 'other', 'driveway', 'void']

export function roomStops(rooms: Room[]): RoomStop[] {
  return [...rooms].filter((r) => r.polygon.length >= 3).sort((a, b) => ROOM_ORDER.indexOf(a.type) - ROOM_ORDER.indexOf(b.type)).map((r) => ({ id: r.id, askWall: keyItemFor(r.type) !== null }))
}

const stepFor = (r: RoomStop): Move => ({ id: r.askWall ? 'furniture' : 'roomVerdict', pendingId: r.id })
const indexOf = (ctx: GuideCtx) => ctx.rooms.findIndex((r) => r.id === ctx.pendingId)

export function nextStep(id: StepId, ctx: GuideCtx): Move {
  switch (id) {
    case 'intro': return { id: 'door' }
    case 'door': return { id: 'owner' }
    case 'owner': return { id: 'more' }
    case 'more': return { id: 'built' }
    case 'built': return { id: 'reveal' }
    case 'reveal': return { id: 'size' }
    case 'size': return { id: 'paint' }
    case 'paint': return ctx.rooms[0] ? stepFor(ctx.rooms[0]) : { id: 'summary' }
    case 'furniture': return { id: 'roomVerdict', pendingId: ctx.pendingId }
    case 'roomVerdict': { const n = ctx.rooms[indexOf(ctx) + 1]; return n ? stepFor(n) : { id: 'summary' } }
    case 'summary': return { id: 'summary' }
  }
}

/** Where the back arrow goes; `null` means leave the guide. */
export function prevStep(id: StepId, ctx: GuideCtx): Move | null {
  switch (id) {
    case 'intro': return null
    case 'door': return ctx.introSeen ? null : { id: 'intro' }
    case 'owner': return { id: 'door' }
    case 'more': return { id: 'owner' }
    case 'built': return { id: 'more' }
    case 'reveal': return { id: 'built' }
    case 'size': return { id: 'reveal' }
    case 'paint': return { id: 'size' }
    case 'furniture': { const p = ctx.rooms[indexOf(ctx) - 1]; return p ? { id: 'roomVerdict', pendingId: p.id } : { id: 'paint' } }
    case 'roomVerdict': {
      const i = indexOf(ctx)
      const r = ctx.rooms[i]
      if (r?.askWall) return { id: 'furniture', pendingId: r.id }
      const p = ctx.rooms[i - 1]
      return p ? { id: 'roomVerdict', pendingId: p.id } : { id: 'paint' }
    }
    case 'summary': { const last = ctx.rooms[ctx.rooms.length - 1]; return last ? { id: 'roomVerdict', pendingId: last.id } : { id: 'paint' } }
  }
}

/** Rough build-year buckets, one per 三元九運 period the user is likely to hit. */
export const BUILT_CHOICES: ReadonlyArray<{ label: string; year: number }> = [
  { label: '2024 年以後', year: 2024 },
  { label: '2004 到 2023', year: 2010 },
  { label: '1984 到 2003', year: 1990 },
  { label: '更早', year: 1970 },
]

/** Room types offered as brushes when painting the sketch, in the order people usually think of them. */
export const BRUSHES: RoomType[] = ['living', 'master', 'bedroom', 'kids', 'kitchen', 'dining', 'bathroom', 'study', 'entry', 'balcony', 'altar', 'storage']
