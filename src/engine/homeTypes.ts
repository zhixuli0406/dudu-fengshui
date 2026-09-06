/**
 * What kind of home this is. Three buckets that matter for the analysis (how many floors the household
 * occupies, and which door sets the facing), each mapped from the building types people actually see on
 * listings and on 內政部實價登錄 (see docs/research/07-home-types.md).
 */
export type HomeType = 'unit' | 'duplex' | 'house'

export interface HomeTypeInfo {
  id: HomeType
  label: string
  /** one line under the label, in the master's voice */
  hint: string
  /** what people call it on listings */
  examples: string
  /** floors the household occupies; 'ask' = let the user say (2–5) */
  floors: number | 'ask'
}

export const HOME_TYPES: HomeTypeInfo[] = [
  { id: 'unit', label: '公寓／大樓的一戶', hint: '一層樓，一個大門', examples: '公寓、華廈、住宅大樓、套房、頂樓加蓋', floors: 1 },
  { id: 'duplex', label: '樓中樓／夾層', hint: '一戶裡面有上下兩層', examples: '樓中樓、挑高夾層、複層', floors: 2 },
  { id: 'house', label: '透天／別墅', hint: '整棟都是你家，大門在一樓', examples: '透天厝、連棟、雙併、獨棟別墅、農舍', floors: 'ask' },
]

export const HOME_TYPE_ZH: Record<HomeType, string> = { unit: '公寓／大樓', duplex: '樓中樓', house: '透天／別墅' }

export function homeTypeInfo(id: HomeType): HomeTypeInfo { return HOME_TYPES.find((h) => h.id === id)! }

/** Floor name for the n-th floor the household occupies (0 = the one with the main door). */
export function floorName(type: HomeType, idx: number): string {
  if (type === 'duplex') return idx === 0 ? '下層' : '上層'
  return `${idx + 1}F`
}

/** Where to stand for the door reading, by home type. */
export const DOOR_STAND: Record<HomeType, string> = {
  unit: '站在自家大門裡面（不是大樓門口），面朝門外。',
  duplex: '站在這一戶的大門裡面，面朝門外。',
  house: '站在一樓大門裡面，面朝門外。',
}
