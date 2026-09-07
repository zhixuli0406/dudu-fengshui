import { emptyPlan, newId, type FloorPlan, type Item, type ItemType, type Room, type RoomType } from './floorplan'
import { pointInPolygon, polygonCentroid, type Point } from './geometry'
import { cellsToRooms, doorOnWall, gridCells, keyItemFor, outlineFromDims, placeAgainstWall, roomDoorTowards, type Cell, type Corner, type Shape, type Wall } from './wizard'
import { palaceOfBearing } from './direction'
import { PALACES } from './bagua'

/** What the wizard (and the guided walk-through) needs to turn a few answers into a plan. */
export interface WizardInput {
  widthM: number
  depthM: number
  shape: Shape
  corner: Corner
  notchWM: number
  notchDM: number
  doorWall: Wall
  doorT: number
  cols: number
  rows: number
  paint: Record<string, RoomType | undefined>
  walls: Record<string, Wall | undefined>
}

export interface DerivedPlan {
  outline: Point[]
  cells: Cell[]
  rooms: Room[]
  /** where you come in: the main door, or the top of the stairs on an upper floor */
  entry: Item
  items: Item[]
  plan: FloorPlan
}

export interface DeriveOptions {
  /** an upper floor: the entry on the bottom wall is the stairs, not a main door, and north is inherited */
  upper?: boolean
  /** bearing the top of the sketch points to (required for upper floors; derived from the door otherwise) */
  northOffset?: number
  name?: string
  level?: number
}

/** Room types that get a door toward the centre of the house automatically. */
const DOORED: RoomType[] = ['master', 'bedroom', 'kids', 'study', 'bathroom', 'kitchen', 'storage', 'altar']

/**
 * Outline from size, rooms from painted cells, entry on its wall, key furniture against the chosen wall.
 * On the main floor `northOffset` is fixed so the main door faces `facingBearing` (the compass reading taken
 * in the doorway); upper floors are drawn the same way up and inherit it.
 * Ids are deterministic (`wz_r0`, `wz_door`, …) so the same answers always give the same plan.
 */
export function deriveWizardPlan(w: WizardInput, facingBearing: number, opts: DeriveOptions = {}): DerivedPlan {
  const outline = outlineFromDims(w.widthM, w.depthM, w.shape, w.corner, w.notchWM, w.notchDM)
  const cells = gridCells(outline, w.cols, w.rows)
  const rooms: Room[] = cellsToRooms(cells, w.paint).map((r, i) => ({ ...r, id: `wz_r${i}` }))
  const entry: Item = opts.upper
    ? { id: 'wz_stairs', ...doorOnWall(outline, w.doorWall, w.doorT, 'stairs') }
    : { id: 'wz_door', ...doorOnWall(outline, w.doorWall, w.doorT) }
  const northOffset = opts.upper && opts.northOffset != null ? opts.northOffset : (((facingBearing - ((entry.facing ?? 0) + 180)) % 360) + 360) % 360
  const center = polygonCentroid(outline)
  const items: Item[] = [entry]
  for (const r of rooms) {
    const wall = w.walls[r.id]
    const key = keyItemFor(r.type)
    if (key && wall) items.push({ id: `wz_i_${r.id}`, ...placeAgainstWall(r, key.item, wall) })
    if (DOORED.includes(r.type)) items.push({ id: `wz_d_${r.id}`, ...roomDoorTowards(r, center) })
  }
  const plan: FloorPlan = { ...emptyPlan(opts.name ?? '1F', opts.level ?? 0), outline, rooms, items, northOffset, gridCm: 50 }
  return { outline, cells, rooms, entry, items, plan }
}

/** Same plan with fresh ids, ready to be saved next to hand-drawn floors. */
export function finalizeWizardPlan(d: DerivedPlan): FloorPlan {
  const idMap = new Map(d.rooms.map((r) => [r.id, newId('r')] as const))
  return {
    ...d.plan,
    rooms: d.rooms.map((r) => ({ ...r, id: idMap.get(r.id)! })),
    items: d.items.map((i) => {
      const byWizard = i.roomId ? idMap.get(i.roomId) : undefined
      const byPos = d.rooms.find((rr) => pointInPolygon({ x: i.x + i.w / 2, y: i.y + i.h / 2 }, rr.polygon))
      return { ...i, id: newId('i'), roomId: byWizard ?? (byPos ? idMap.get(byPos.id) : undefined) }
    }),
  }
}

/** Compass bearing a wall of the sketch lies toward; `northOffset` is the bearing the top of the sketch points to. */
export function wallBearing(wall: Wall, northOffset: number): number {
  const turn: Record<Wall, number> = { top: 0, right: 90, bottom: 180, left: 270 }
  return (((northOffset + turn[wall]) % 360) + 360) % 360
}

export function wallDirectionZh(wall: Wall, northOffset: number): string {
  return PALACES[palaceOfBearing(wallBearing(wall, northOffset))].direction
}

/** One line under the furniture question: why the master cares about this piece. */
export const ITEM_WHY: Partial<Record<ItemType, string>> = {
  bed: '床頭的方向，影響睡的人最深。',
  stove: '灶口朝哪，管一家人的食祿。',
  desk: '坐向對了，書才讀得進去。',
  toilet: '馬桶靠哪邊，穢氣就往哪邊走。',
  sofa: '沙發要背後有靠，坐得才穩。',
  altar: '神位要朝吉方，背後要靠實牆。',
}
