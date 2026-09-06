import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from './bagua'
import { ITEM_DEFAULT, emptyPlan, type FloorPlan, type Item, type ItemType, type Room, type RoomType } from './floorplan'
import { palaceOfBearing } from './direction'

/**
 * "Lite" rooms: no geometry, just which palace (compass sector) of the house the room sits in and, for the
 * key furniture, which direction it faces. Enough for 八宅／玄空／流年; 形勢 (geometry) rules are skipped.
 */
export interface LiteRoom {
  id: string
  type: RoomType
  /** which sector of the house the room is in */
  palace: Trigram
  /** bed head / stove mouth / desk facing / altar facing, as a compass palace */
  facing?: Trigram
}

const SIZE = 900 // cm, synthetic square house
const CELL = SIZE / 3

/** 3×3 cell (col,row) for a palace on a north-up plan. */
const CELL_OF: Record<Trigram, [number, number]> = { kan: [1, 0], gen: [2, 0], zhen: [2, 1], xun: [2, 2], li: [1, 2], kun: [0, 2], dui: [0, 1], qian: [0, 0] }

export function keyItemOf(type: RoomType): ItemType | null {
  switch (type) {
    case 'master': case 'bedroom': case 'kids': return 'bed'
    case 'kitchen': return 'stove'
    case 'study': return 'desk'
    case 'bathroom': return 'toilet'
    case 'living': return 'sofa'
    case 'altar': return 'altar'
    default: return null
  }
}

export const FACING_QUESTION: Partial<Record<RoomType, string>> = {
  master: '床頭朝哪個方向？', bedroom: '床頭朝哪個方向？', kids: '床頭朝哪個方向？', kitchen: '爐灶的開關面朝哪個方向？', study: '坐著時面朝哪個方向？', altar: '神位面朝哪個方向？',
}

/**
 * Build a schematic square plan (north up, 9 m × 9 m) from facing bearing + lite rooms so the regular
 * report engine can run. The main door sits on the wall the house faces; rooms occupy their palace cell.
 */
export function synthesizePlan(facingBearing: number, rooms: LiteRoom[]): FloorPlan {
  const plan: FloorPlan = { ...emptyPlan('示意', 0), synthetic: true, northOffset: 0, gridCm: 50 }
  plan.outline = [{ x: 0, y: 0 }, { x: SIZE, y: 0 }, { x: SIZE, y: SIZE }, { x: 0, y: SIZE }]
  const items: Item[] = []
  const outRooms: Room[] = []
  // main door on the facing side
  const facePal = palaceOfBearing(facingBearing)
  const [dc, dr] = CELL_OF[facePal]
  const doorSize = ITEM_DEFAULT.mainDoor
  const doorCx = dc === 0 ? 0 : dc === 2 ? SIZE : SIZE / 2
  const doorCy = dr === 0 ? 0 : dr === 2 ? SIZE : SIZE / 2
  const onVertical = dc !== 1 && dr === 1
  const facing = dr === 0 && dc === 1 ? 180 : dr === 2 && dc === 1 ? 0 : dc === 0 ? 90 : dc === 2 ? 270 : (dr === 0 ? 180 : 0)
  items.push({ id: 'lite_door', type: 'mainDoor', x: (onVertical ? doorCx : doorCx) - doorSize.w / 2, y: doorCy - doorSize.h / 2, w: doorSize.w, h: doorSize.h, facing: onVertical ? facing : (dr === 0 ? 180 : dr === 2 ? 0 : facing) })
  for (const r of rooms) {
    const [c, row] = CELL_OF[r.palace]
    const x = c * CELL, y = row * CELL
    const room: Room = { id: r.id, type: r.type, polygon: [{ x, y }, { x: x + CELL, y }, { x: x + CELL, y: y + CELL }, { x, y: y + CELL }] }
    outRooms.push(room)
    const key = keyItemOf(r.type)
    if (key) {
      const s = ITEM_DEFAULT[key]
      const f = r.facing ? PALACES[r.facing].bearing : key === 'toilet' || key === 'sofa' ? 0 : PALACES[r.palace].bearing
      items.push({ id: `lite_${r.id}_${key}`, type: key, x: x + CELL / 2 - s.w / 2, y: y + CELL / 2 - s.h / 2, w: s.w, h: s.h, facing: f, roomId: r.id })
    }
  }
  plan.rooms = outRooms
  plan.items = items
  return plan
}

export const PALACE_CHOICES: Trigram[] = [...TRIGRAMS_CLOCKWISE]
