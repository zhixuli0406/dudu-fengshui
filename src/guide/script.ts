import { FACING_QUESTION, type LiteRoom } from '../engine/lite'
import type { RoomType } from '../engine/floorplan'

/**
 * The guided walk-through ("師傅來看房"): one question per screen in the master's voice, a short
 * scene before, a reveal in the middle and a wrap-up at the end. This module is the pure state
 * machine; `pages/StartPage.tsx` renders it.
 */
export type StepId =
  | 'intro' // scene: the master arrives at the door
  | 'door' // which way the main door faces
  | 'owner' // who runs the household (first person)
  | 'more' // anyone else to include
  | 'built' // roughly when the house was built (period)
  | 'reveal' // scene: house gua, wealth / study positions, owner's fit
  | 'roomWhere' // which sector a room is in
  | 'roomFacing' // bed head / stove mouth / desk facing
  | 'roomVerdict' // scene: what the master says about that room
  | 'roomType' // pick the next room, or stop
  | 'summary' // scene: score, top to-dos, exits

export interface GuideCtx {
  introSeen: boolean
  hasFacing: boolean
  persons: number
  rooms: LiteRoom[]
  /** room type currently being asked about (chosen on `roomType`, or master bedroom the first time) */
  pendingType?: RoomType
  /** id of the lite room created on `roomWhere`, so `roomFacing` / `roomVerdict` know which one */
  pendingId?: string
}

/** Fixed spine used for the "n / N" counter; the room loop repeats at the tail. */
export const SPINE: StepId[] = ['door', 'owner', 'more', 'built', 'roomWhere', 'roomFacing', 'roomType']

export function progressOf(id: StepId): { n: number; total: number } {
  const total = SPINE.length
  const i = SPINE.indexOf(id)
  if (i >= 0) return { n: i + 1, total }
  if (id === 'intro') return { n: 0, total }
  if (id === 'reveal') return { n: 4, total }
  if (id === 'roomVerdict') return { n: 6, total }
  return { n: total, total }
}

export function firstStep(ctx: GuideCtx): StepId {
  return ctx.introSeen ? 'door' : 'intro'
}

export function hasFacingQuestion(type: RoomType): boolean {
  return Boolean(FACING_QUESTION[type])
}

/** The room the next `roomWhere` should ask about: what was picked, or the master bedroom to start. */
export function pendingRoomType(ctx: GuideCtx): RoomType | undefined {
  if (ctx.pendingType) return ctx.pendingType
  return ctx.rooms.length === 0 ? 'master' : undefined
}

export function nextStep(id: StepId, ctx: GuideCtx): StepId {
  switch (id) {
    case 'intro': return 'door'
    case 'door': return 'owner'
    case 'owner': return 'more'
    case 'more': return 'built'
    case 'built': return 'reveal'
    case 'reveal': return pendingRoomType(ctx) ? 'roomWhere' : 'roomType'
    case 'roomWhere': return ctx.pendingType && hasFacingQuestion(ctx.pendingType) ? 'roomFacing' : 'roomVerdict'
    case 'roomFacing': return 'roomVerdict'
    case 'roomVerdict': return 'roomType'
    case 'roomType': return ctx.pendingType ? 'roomWhere' : 'summary'
    case 'summary': return 'summary'
  }
}

/** Where the back arrow goes; `null` means leave the guide. */
export function prevStep(id: StepId, ctx: GuideCtx): StepId | null {
  switch (id) {
    case 'intro': return null
    case 'door': return ctx.introSeen ? null : 'intro'
    case 'owner': return 'door'
    case 'more': return 'owner'
    case 'built': return 'more'
    case 'reveal': return 'built'
    case 'roomWhere': return ctx.rooms.length ? 'roomType' : 'reveal'
    case 'roomFacing': return 'roomWhere'
    case 'roomVerdict': return ctx.pendingType && hasFacingQuestion(ctx.pendingType) ? 'roomFacing' : 'roomWhere'
    case 'roomType': return ctx.rooms.length ? 'roomVerdict' : 'reveal'
    case 'summary': return 'roomType'
  }
}

/** Rough build-year buckets, one per 三元九運 period the user is likely to hit. */
export const BUILT_CHOICES: ReadonlyArray<{ label: string; year: number }> = [
  { label: '2024 年以後', year: 2024 },
  { label: '2004 到 2023', year: 2010 },
  { label: '1984 到 2003', year: 1990 },
  { label: '更早', year: 1970 },
]

/** Rooms offered on `roomType`, in the order the master would walk them. */
export const ROOM_MENU: RoomType[] = ['master', 'bedroom', 'kids', 'kitchen', 'study', 'bathroom', 'living', 'altar']

/** Rooms still worth asking about: each type once, except extra bedrooms. */
export function roomMenu(rooms: LiteRoom[]): RoomType[] {
  const taken = new Set(rooms.map((r) => r.type))
  return ROOM_MENU.filter((t) => t === 'bedroom' || !taken.has(t))
}

/** One line under the facing question: why the master cares. */
export const FACING_WHY: Partial<Record<RoomType, string>> = {
  master: '床頭的方向，影響睡的人最深。',
  bedroom: '床頭的方向，影響睡的人最深。',
  kids: '小孩睡得安穩，比什麼都要緊。',
  kitchen: '灶口朝哪，管一家人的食祿。',
  study: '坐向對了，書才讀得進去。',
  altar: '神位要朝吉方，背後要靠實牆。',
}
