import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { emptyPlan, newId, type FloorPlan, type Item, type Room } from '../engine/floorplan'
import type { Person } from '../engine/report'

export interface Settings {
  /** apply magnetic declination to compass readings */
  useTrueNorth: boolean
  /** degrees, east positive */
  declination: number
  location?: { lat: number; lon: number; accuracy?: number; at: string }
  /** 九宮顯示：扇形或方格 */
  gridStyle: 'pie' | 'grid'
}

export type FacingBasis = 'unitDoor' | 'balcony' | 'buildingDoor'
export type StoveMode = 'seatBadFaceGood' | 'allGood'

export interface HouseState {
  facingBearing: number
  facingSource: 'compass' | 'manual' | 'ar' | 'none'
  /** 取向依據：自家大門／陽台採光面／大樓大門（各派有別） */
  facingBasis: FacingBasis
  /** 灶位判法：座凶向吉（坊間）或全在吉方（多數可查來源） */
  stoveMode: StoveMode
  /** 兼向門檻（度）：4.5 沈氏／3.5 玄空館／6 高端風水網 */
  jianxiangTolerance: number
  /** 兼向時是否自動改用替卦起星 */
  replacementMode: 'auto' | 'never'
  periodYear: number
  lunarMonth?: number
}

interface AppState {
  persons: Person[]
  house: HouseState
  /** 目前編輯中的樓層（= floors[activeFloor]） */
  plan: FloorPlan
  floors: FloorPlan[]
  activeFloor: number
  settings: Settings
  /** 外局問卷答案 */
  environment: Record<string, boolean | string>
  addPerson: (p: Omit<Person, 'id'>) => void
  updatePerson: (id: string, patch: Partial<Person>) => void
  removePerson: (id: string) => void
  setHouse: (patch: Partial<HouseState>) => void
  setPlan: (plan: FloorPlan) => void
  updatePlan: (fn: (plan: FloorPlan) => FloorPlan) => void
  setActiveFloor: (index: number) => void
  addFloor: (opts?: { copyOutline?: boolean; level?: number; name?: string }) => void
  removeFloor: (index: number) => void
  addRoom: (room: Omit<Room, 'id'>) => string
  updateRoom: (id: string, patch: Partial<Room>) => void
  removeRoom: (id: string) => void
  addItem: (item: Omit<Item, 'id'>) => string
  updateItem: (id: string, patch: Partial<Item>) => void
  removeItem: (id: string) => void
  setSettings: (patch: Partial<Settings>) => void
  setEnvironment: (key: string, value: boolean) => void
  setEnvironmentOption: (key: string, value: string) => void
  resetAll: () => void
}

const initialHouse: HouseState = { facingBearing: 180, facingSource: 'none', facingBasis: 'unitDoor', stoveMode: 'allGood', jianxiangTolerance: 4.5, replacementMode: 'auto', periodYear: new Date().getFullYear() }
const initialSettings: Settings = { useTrueNorth: false, declination: 0, gridStyle: 'pie' }

/** Apply a plan mutation to both `plan` and `floors[activeFloor]`. */
function withPlan(s: AppState, fn: (p: FloorPlan) => FloorPlan): Pick<AppState, 'plan' | 'floors'> {
  const plan = fn(s.plan)
  const floors = s.floors.map((f, i) => (i === s.activeFloor ? plan : f))
  return { plan, floors }
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      persons: [],
      house: initialHouse,
      plan: emptyPlan(),
      floors: [emptyPlan()],
      activeFloor: 0,
      settings: initialSettings,
      environment: {},
      addPerson: (p) => set((s) => ({ persons: [...s.persons, { ...p, id: newId('p'), primary: s.persons.length === 0 ? true : p.primary }] })),
      updatePerson: (id, patch) => set((s) => ({ persons: s.persons.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removePerson: (id) => set((s) => ({ persons: s.persons.filter((p) => p.id !== id) })),
      setHouse: (patch) => set((s) => ({ house: { ...s.house, ...patch } })),
      setPlan: (plan) => set((s) => withPlan(s, (p) => ({ ...plan, name: plan.name ?? p.name, level: plan.level ?? p.level }))),
      updatePlan: (fn) => set((s) => withPlan(s, fn)),
      setActiveFloor: (index) => set((s) => (s.floors[index] ? { activeFloor: index, plan: s.floors[index]! } : {})),
      addFloor: (opts = {}) => set((s) => {
        const level = opts.level ?? Math.max(...s.floors.map((f) => f.level ?? 0)) + 1
        const name = opts.name ?? (level >= 0 ? `${level + 1}F` : `B${-level}`)
        const base = opts.copyOutline === false ? emptyPlan(name, level) : { ...emptyPlan(name, level), outline: s.plan.outline.map((q) => ({ ...q })), northOffset: s.plan.northOffset, gridCm: s.plan.gridCm }
        const floors = [...s.floors, base]
        return { floors, activeFloor: floors.length - 1, plan: base }
      }),
      removeFloor: (index) => set((s) => {
        if (s.floors.length <= 1) return {}
        const floors = s.floors.filter((_, i) => i !== index)
        const activeFloor = Math.min(s.activeFloor, floors.length - 1)
        return { floors, activeFloor, plan: floors[activeFloor]! }
      }),
      addRoom: (room) => {
        const id = newId('r')
        set((s) => withPlan(s, (p) => ({ ...p, rooms: [...p.rooms, { ...room, id }] })))
        return id
      },
      updateRoom: (id, patch) => set((s) => withPlan(s, (p) => ({ ...p, rooms: p.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))),
      removeRoom: (id) => set((s) => withPlan(s, (p) => ({ ...p, rooms: p.rooms.filter((r) => r.id !== id), items: p.items.map((i) => (i.roomId === id ? { ...i, roomId: undefined } : i)) }))),
      addItem: (item) => {
        const id = newId('i')
        set((s) => withPlan(s, (p) => ({ ...p, items: [...p.items, { ...item, id }] })))
        return id
      },
      updateItem: (id, patch) => set((s) => withPlan(s, (p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))),
      removeItem: (id) => set((s) => withPlan(s, (p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }))),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setEnvironment: (key, value) => set((s) => ({ environment: { ...s.environment, [key]: value } })),
      setEnvironmentOption: (key, value) => set((s) => ({ environment: { ...s.environment, [key]: value } })),
      resetAll: () => set({ persons: [], house: initialHouse, plan: emptyPlan(), floors: [emptyPlan()], activeFloor: 0, settings: initialSettings, environment: {} }),
    }),
    {
      name: 'dudu-fengshui-v1',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>
        const floors = p.floors && p.floors.length ? p.floors : [p.plan ?? current.plan]
        const activeFloor = Math.min(p.activeFloor ?? 0, floors.length - 1)
        return { ...current, ...p, floors, activeFloor, plan: floors[activeFloor]!, house: { ...current.house, ...p.house }, settings: { ...current.settings, ...p.settings } }
      },
    },
  ),
)
