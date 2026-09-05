import type { Element } from './fiveElements'

/** 後天八卦 (Later Heaven) palaces. `center` is the 中宮. */
export type Trigram = 'kan' | 'gen' | 'zhen' | 'xun' | 'li' | 'kun' | 'dui' | 'qian'
export type Palace = Trigram | 'center'

export interface PalaceInfo {
  key: Palace
  zh: string
  /** 洛書數 */
  luoshu: number
  /** Compass bearing of the palace centre, degrees clockwise from north. */
  bearing: number
  direction: string
  directionShort: string
  element: Element
  /** 八卦人事 */
  family: string
  body: string
  /** 東四 / 西四 */
  group: 'east' | 'west' | 'none'
  colors: string[]
}

export const PALACES: Record<Palace, PalaceInfo> = {
  kan: { key: 'kan', zh: '坎', luoshu: 1, bearing: 0, direction: '北', directionShort: 'N', element: 'water', family: '中男', body: '耳、腎、泌尿', group: 'east', colors: ['黑', '藍'] },
  gen: { key: 'gen', zh: '艮', luoshu: 8, bearing: 45, direction: '東北', directionShort: 'NE', element: 'earth', family: '少男', body: '手、指、脾胃', group: 'west', colors: ['黃', '棕'] },
  zhen: { key: 'zhen', zh: '震', luoshu: 3, bearing: 90, direction: '東', directionShort: 'E', element: 'wood', family: '長男', body: '足、肝', group: 'east', colors: ['綠', '青'] },
  xun: { key: 'xun', zh: '巽', luoshu: 4, bearing: 135, direction: '東南', directionShort: 'SE', element: 'wood', family: '長女', body: '股、膽、神經', group: 'east', colors: ['綠', '淺綠'] },
  li: { key: 'li', zh: '離', luoshu: 9, bearing: 180, direction: '南', directionShort: 'S', element: 'fire', family: '中女', body: '目、心、血', group: 'east', colors: ['紅', '紫'] },
  kun: { key: 'kun', zh: '坤', luoshu: 2, bearing: 225, direction: '西南', directionShort: 'SW', element: 'earth', family: '母親／女主人', body: '腹、脾胃', group: 'west', colors: ['黃', '米'] },
  dui: { key: 'dui', zh: '兌', luoshu: 7, bearing: 270, direction: '西', directionShort: 'W', element: 'metal', family: '少女', body: '口、肺、喉', group: 'west', colors: ['白', '金'] },
  qian: { key: 'qian', zh: '乾', luoshu: 6, bearing: 315, direction: '西北', directionShort: 'NW', element: 'metal', family: '父親／男主人', body: '頭、肺、骨', group: 'west', colors: ['白', '金', '銀'] },
  center: { key: 'center', zh: '中', luoshu: 5, bearing: NaN, direction: '中宮', directionShort: 'C', element: 'earth', family: '全家', body: '脾胃、心腹', group: 'none', colors: ['黃'] },
}

/** Eight trigrams in clockwise compass order starting from north. */
export const TRIGRAMS_CLOCKWISE: readonly Trigram[] = ['kan', 'gen', 'zhen', 'xun', 'li', 'kun', 'dui', 'qian'] as const

export const TRIGRAM_BY_LUOSHU: Record<number, Palace> = {
  1: 'kan', 2: 'kun', 3: 'zhen', 4: 'xun', 5: 'center', 6: 'qian', 7: 'dui', 8: 'gen', 9: 'li',
}

/** 洛書順飛 order: 中→乾→兌→艮→離→坎→坤→震→巽 (i.e. luoshu 5,6,7,8,9,1,2,3,4). */
export const LUOSHU_FLIGHT_ORDER: readonly Palace[] = ['center', 'qian', 'dui', 'gen', 'li', 'kan', 'kun', 'zhen', 'xun'] as const

/** Opposite palace (對宮). */
export function oppositePalace(p: Trigram): Trigram {
  const i = TRIGRAMS_CLOCKWISE.indexOf(p)
  return TRIGRAMS_CLOCKWISE[(i + 4) % 8]!
}

export function isEastGroup(p: Trigram): boolean {
  return PALACES[p].group === 'east'
}
