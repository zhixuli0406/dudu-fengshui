import type { Point, Rect } from './geometry'

/** All coordinates in centimetres; screen convention (y grows downward). */
export type RoomType =
  | 'living' | 'bedroom' | 'master' | 'kids' | 'study' | 'kitchen' | 'dining' | 'bathroom'
  | 'entry' | 'balcony' | 'altar' | 'storage' | 'corridor' | 'driveway' | 'void' | 'other'

export const ROOM_ZH: Record<RoomType, string> = {
  living: '客廳', bedroom: '臥室', master: '主臥', kids: '兒童房', study: '書房', kitchen: '廚房', dining: '餐廳',
  bathroom: '廁所／浴室', entry: '玄關', balcony: '陽台', altar: '神明廳', storage: '儲藏室', corridor: '走道', driveway: '騎樓／車道', void: '挑空', other: '其他',
}

export type ItemType =
  | 'mainDoor' | 'door' | 'window' | 'bed' | 'stove' | 'sink' | 'fridge' | 'toilet' | 'desk'
  | 'sofa' | 'mirror' | 'beam' | 'altar' | 'stairs' | 'elevator' | 'aquarium' | 'column' | 'tv' | 'plant' | 'lamp'

export const ITEM_ZH: Record<ItemType, string> = {
  mainDoor: '大門', door: '房門', window: '窗', bed: '床', stove: '爐灶', sink: '水槽', fridge: '冰箱', toilet: '馬桶',
  desk: '書桌／辦公桌', sofa: '沙發', mirror: '鏡子', beam: '樑', altar: '神位', stairs: '樓梯', elevator: '電梯（門外）',
  aquarium: '魚缸', column: '柱', tv: '電視', plant: '植物', lamp: '吊燈／吊扇',
}

/** Default sizes (cm). */
export const ITEM_DEFAULT: Record<ItemType, { w: number; h: number }> = {
  mainDoor: { w: 90, h: 10 }, door: { w: 80, h: 10 }, window: { w: 120, h: 10 }, bed: { w: 150, h: 200 },
  stove: { w: 75, h: 50 }, sink: { w: 60, h: 50 }, fridge: { w: 70, h: 70 }, toilet: { w: 40, h: 70 },
  desk: { w: 120, h: 60 }, sofa: { w: 200, h: 90 }, mirror: { w: 60, h: 6 }, beam: { w: 300, h: 30 },
  altar: { w: 90, h: 50 }, stairs: { w: 100, h: 250 }, elevator: { w: 120, h: 120 }, aquarium: { w: 80, h: 40 },
  column: { w: 40, h: 40 }, tv: { w: 120, h: 20 }, plant: { w: 40, h: 40 }, lamp: { w: 60, h: 60 },
}

export interface Room {
  id: string
  type: RoomType
  name?: string
  /** polygon in cm */
  polygon: Point[]
}

export interface Item extends Rect {
  id: string
  type: ItemType
  /**
   * Facing direction in screen degrees (0 = up, clockwise):
   * door → direction it opens into (inside); bed → direction the head points to (床頭方向);
   * stove → direction the cook faces (灶口); desk → direction the person faces; mirror → reflecting face normal.
   */
  facing: number
  roomId?: string
  label?: string
  /** 樑：樑下垂深度（cm）；≥ 30 加重 */
  depthCm?: number
  /** 吊燈／鏡等的離地高度（cm），選填 */
  heightCm?: number
}

export interface FloorPlan {
  /** 樓層名稱（1F、2F、夾層…） */
  name?: string
  /** 樓層序：0 = 主層（含大門），+1 為上一層、−1 為下一層 */
  level?: number
  /** 天花板淨高（cm），選填 */
  ceilingHeightCm?: number
  /** outer wall outline (cm) */
  outline: Point[]
  rooms: Room[]
  items: Item[]
  /** compass bearing (true north based) of the plan's "up" direction */
  northOffset: number
  /** scale hint for the editor: cm per grid cell */
  gridCm: number
  /** 照片／建商平面圖底圖（描圖用），座標為 cm */
  underlay?: Underlay
}

export interface Underlay {
  /** downscaled JPEG data URL */
  dataUrl: string
  /** natural pixel size of the stored image */
  pxW: number
  pxH: number
  /** placement in plan cm */
  x: number
  y: number
  /** cm per image pixel */
  cmPerPx: number
  opacity: number
  /** rotation in degrees about the image centre */
  rotation: number
}

export function emptyPlan(name = '1F', level = 0): FloorPlan {
  return { name, level, outline: [], rooms: [], items: [], northOffset: 0, gridCm: 50 }
}

/** The floor that holds the main door, else level 0, else the first. */
export function mainFloor(floors: FloorPlan[]): FloorPlan {
  return floors.find((f) => f.items.some((i) => i.type === 'mainDoor')) ?? floors.find((f) => (f.level ?? 0) === 0) ?? floors[0] ?? emptyPlan()
}

export function itemsOfType(plan: FloorPlan, t: ItemType): Item[] {
  return plan.items.filter((i) => i.type === t)
}

let counter = 0
export function newId(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter}`
}
