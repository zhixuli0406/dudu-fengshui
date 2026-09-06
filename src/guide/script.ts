import type { FloorPlan, Room, RoomType } from '../engine/floorplan'
import { keyItemFor } from '../engine/wizard'

/**
 * The guided walk-through ("師傅來看房"): one question per screen in the master's voice. Home type
 * (how many floors) → door by compass → people → period → reveal → each floor is built either by
 * walking it in AR or by sketching it, then every room gets its verdict → summary.
 * This module is the pure state machine; `pages/StartPage.tsx` renders it.
 */
export type StepId =
  | 'intro' // scene: the master arrives at the door
  | 'home' // what kind of home (floors)
  | 'door' // which way the main door faces (compass)
  | 'owner' // who runs the household (first person)
  | 'more' // anyone else to include
  | 'built' // roughly when the house was built (period)
  | 'reveal' // scene: house gua, wealth / study positions, owner's fit
  | 'build' // AR walk or sketch? (only when AR is available)
  | 'walk' // AR capture of one floor
  | 'size' // sketch: how big, seen from the doorway
  | 'paint' // sketch: paint rooms
  | 'furniture' // which wall the key piece of one room is against
  | 'roomVerdict' // scene: what the master says about that room
  | 'upstairs' // scene: this floor is done, go up
  | 'summary' // scene: score, top to-dos, exits

export const STEP_IDS: StepId[] = ['intro', 'home', 'door', 'owner', 'more', 'built', 'reveal', 'build', 'walk', 'size', 'paint', 'furniture', 'roomVerdict', 'upstairs', 'summary']
export function isStepId(x: unknown): x is StepId { return typeof x === 'string' && (STEP_IDS as string[]).includes(x) }

/** A room in the order the master walks them, and whether its key piece of furniture still has to be placed. */
export interface RoomStop { id: string; askWall: boolean }
/** How a floor's plan came to be; decides where "back" from the first room goes. */
export type FloorSource = 'sketch' | 'ar' | 'other' | 'none'

export interface GuideCtx {
  introSeen: boolean
  hasFacing: boolean
  persons: number
  /** AR capture is possible on this device */
  arAvailable: boolean
  /** floors the household occupies (1 for a flat) */
  floorCount: number
  floorIdx: number
  /** room stops per floor */
  floorRooms: RoomStop[][]
  floorSources: FloorSource[]
  /** the room currently being asked about / judged */
  pendingId?: string
}

/** Where to go next: a step and, when it changes, which room / floor. */
export interface Move { id: StepId; pendingId?: string; floorIdx?: number }

/** Fixed spine used for the "n / N" counter; building and the room loop repeat per floor at the tail. */
export const SPINE: StepId[] = ['home', 'door', 'owner', 'more', 'built', 'build', 'paint', 'furniture']

export function progressOf(id: StepId): { n: number; total: number } {
  const total = SPINE.length
  const i = SPINE.indexOf(id)
  if (i >= 0) return { n: i + 1, total }
  switch (id) {
    case 'intro': return { n: 0, total }
    case 'reveal': return { n: 5, total }
    case 'walk': case 'size': return { n: 6, total }
    default: return { n: total, total }
  }
}

export function firstStep(ctx: GuideCtx): StepId {
  return ctx.introSeen ? 'home' : 'intro'
}

/** The order the master walks the rooms: sleeping first, then fire, then the rest. */
export const ROOM_ORDER: RoomType[] = ['master', 'bedroom', 'kids', 'kitchen', 'study', 'bathroom', 'living', 'altar', 'dining', 'entry', 'balcony', 'storage', 'corridor', 'other', 'driveway', 'void']

/** Rooms of a floor in walking order; a wall question only when the key piece is not placed yet. */
export function roomStops(plan: Pick<FloorPlan, 'rooms' | 'items'>): RoomStop[] {
  const has = (r: Room) => { const key = keyItemFor(r.type); return !!key && plan.items.some((i) => i.roomId === r.id && i.type === key.item) }
  return [...plan.rooms].filter((r) => r.polygon.length >= 3).sort((a, b) => ROOM_ORDER.indexOf(a.type) - ROOM_ORDER.indexOf(b.type)).map((r) => ({ id: r.id, askWall: keyItemFor(r.type) !== null && !has(r) }))
}

export function floorSource(plan: Pick<FloorPlan, 'rooms' | 'outline'> | undefined): FloorSource {
  if (!plan || plan.outline.length < 3) return 'none'
  if (plan.rooms.length && plan.rooms.every((r) => r.id.startsWith('wz_'))) return 'sketch'
  if (plan.rooms.length && plan.rooms.every((r) => r.id.startsWith('r_ar_'))) return 'ar'
  return plan.rooms.length ? 'other' : 'none'
}

const roomsOf = (ctx: GuideCtx, floor = ctx.floorIdx) => ctx.floorRooms[floor] ?? []
const stepFor = (r: RoomStop, floorIdx: number): Move => ({ id: r.askWall ? 'furniture' : 'roomVerdict', pendingId: r.id, floorIdx })
const indexOf = (ctx: GuideCtx) => roomsOf(ctx).findIndex((r) => r.id === ctx.pendingId)

/** How building starts on a floor: the AR/sketch choice when AR exists, else straight to the sketch. */
export function entryOf(ctx: GuideCtx, floorIdx: number): Move {
  return { id: ctx.arAvailable ? 'build' : 'size', floorIdx }
}

/** After the last room of a floor: the next floor, or the wrap-up. */
export function endOfFloor(ctx: GuideCtx): Move {
  return ctx.floorIdx + 1 < ctx.floorCount ? { id: 'upstairs', floorIdx: ctx.floorIdx } : { id: 'summary' }
}

/** First room stop of the current floor, or the end of the floor when there are none. */
export function firstRoom(ctx: GuideCtx): Move {
  const r = roomsOf(ctx)[0]
  return r ? stepFor(r, ctx.floorIdx) : endOfFloor(ctx)
}

export function nextStep(id: StepId, ctx: GuideCtx): Move {
  switch (id) {
    case 'intro': return { id: 'home' }
    case 'home': return { id: 'door' }
    case 'door': return { id: 'owner' }
    case 'owner': return { id: 'more' }
    case 'more': return { id: 'built' }
    case 'built': return { id: 'reveal' }
    case 'reveal': return entryOf(ctx, 0)
    case 'build': return { id: 'size', floorIdx: ctx.floorIdx }
    case 'walk': return firstRoom(ctx)
    case 'size': return { id: 'paint', floorIdx: ctx.floorIdx }
    case 'paint': return firstRoom(ctx)
    case 'furniture': return { id: 'roomVerdict', pendingId: ctx.pendingId, floorIdx: ctx.floorIdx }
    case 'roomVerdict': { const n = roomsOf(ctx)[indexOf(ctx) + 1]; return n ? stepFor(n, ctx.floorIdx) : endOfFloor(ctx) }
    case 'upstairs': return entryOf(ctx, ctx.floorIdx + 1)
    case 'summary': return { id: 'summary' }
  }
}

/** Where the back arrow goes; `null` means leave the guide. */
export function prevStep(id: StepId, ctx: GuideCtx): Move | null {
  const k = ctx.floorIdx
  const beforeBuild = (): Move => (k === 0 ? { id: 'reveal' } : { id: 'upstairs', floorIdx: k - 1 })
  const beforeRooms = (): Move => {
    const src = ctx.floorSources[k] ?? 'none'
    if (src === 'sketch') return { id: 'paint', floorIdx: k }
    if (src === 'ar') return ctx.arAvailable ? { id: 'build', floorIdx: k } : beforeBuild()
    return ctx.arAvailable ? { id: 'build', floorIdx: k } : { id: 'size', floorIdx: k }
  }
  const lastRoomOf = (floor: number): Move => { const rooms = roomsOf(ctx, floor); const last = rooms[rooms.length - 1]; return last ? { id: 'roomVerdict', pendingId: last.id, floorIdx: floor } : { ...beforeRooms(), floorIdx: floor } }
  switch (id) {
    case 'intro': return null
    case 'home': return ctx.introSeen ? null : { id: 'intro' }
    case 'door': return { id: 'home' }
    case 'owner': return { id: 'door' }
    case 'more': return { id: 'owner' }
    case 'built': return { id: 'more' }
    case 'reveal': return { id: 'built' }
    case 'build': return beforeBuild()
    case 'walk': return { id: 'build', floorIdx: k }
    case 'size': return ctx.arAvailable ? { id: 'build', floorIdx: k } : beforeBuild()
    case 'paint': return { id: 'size', floorIdx: k }
    case 'furniture': { const p = roomsOf(ctx)[indexOf(ctx) - 1]; return p ? { id: 'roomVerdict', pendingId: p.id, floorIdx: k } : beforeRooms() }
    case 'roomVerdict': {
      const i = indexOf(ctx)
      const r = roomsOf(ctx)[i]
      if (r?.askWall) return { id: 'furniture', pendingId: r.id, floorIdx: k }
      const p = roomsOf(ctx)[i - 1]
      return p ? { id: 'roomVerdict', pendingId: p.id, floorIdx: k } : beforeRooms()
    }
    case 'upstairs': return lastRoomOf(k)
    case 'summary': return lastRoomOf(Math.max(0, ctx.floorCount - 1))
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
