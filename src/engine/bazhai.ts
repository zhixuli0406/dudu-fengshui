import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from './bagua'
import type { Element } from './fiveElements'

export type Gender = 'male' | 'female'

/** 八遊星 */
export type WanderingStar = 'shengqi' | 'tianyi' | 'yannian' | 'fuwei' | 'jueming' | 'wugui' | 'liusha' | 'huohai'

export interface StarInfo {
  key: WanderingStar
  zh: string
  element: Element
  /** 1 = best … 4 = neutral, -1…-4 worst */
  rank: number
  auspicious: boolean
  keyword: string
  goodFor: string[]
  avoid: string[]
}

export const WANDERING_STARS: Record<WanderingStar, StarInfo> = {
  shengqi: { key: 'shengqi', zh: '生氣', element: 'wood', rank: 1, auspicious: true, keyword: '貪狼星，主旺丁旺財、活力升遷', goodFor: ['大門', '床頭朝向', '書桌', '客廳', '主臥'], avoid: ['廁所', '儲藏室'] },
  tianyi: { key: 'tianyi', zh: '天醫', element: 'earth', rank: 2, auspicious: true, keyword: '巨門星，主健康、貴人、財運', goodFor: ['臥室', '床頭朝向', '廚房（灶口朝向）', '餐廳'], avoid: ['廁所'] },
  yannian: { key: 'yannian', zh: '延年', element: 'metal', rank: 3, auspicious: true, keyword: '武曲星，主婚姻和諧、長壽、人際', goodFor: ['主臥', '床頭朝向', '客廳', '大門'], avoid: ['廁所', '廚房'] },
  fuwei: { key: 'fuwei', zh: '伏位', element: 'wood', rank: 4, auspicious: true, keyword: '輔弼星，主平穩、守成、小財', goodFor: ['床頭朝向', '神位', '書房'], avoid: [] },
  huohai: { key: 'huohai', zh: '禍害', element: 'earth', rank: -1, auspicious: false, keyword: '祿存星，主是非口舌、小病、精神不寧', goodFor: ['廁所', '儲藏室', '廚房（壓制）'], avoid: ['大門', '床頭朝向', '書桌'] },
  liusha: { key: 'liusha', zh: '六煞', element: 'water', rank: -2, auspicious: false, keyword: '文曲星，主桃花是非、官非、爭執', goodFor: ['廁所', '廚房（壓制）', '儲藏室'], avoid: ['大門', '主臥', '床頭朝向'] },
  wugui: { key: 'wugui', zh: '五鬼', element: 'fire', rank: -3, auspicious: false, keyword: '廉貞星，主火災、意外、小人、破財', goodFor: ['廁所', '廚房（灶座壓制）', '儲藏室'], avoid: ['大門', '臥室', '神位'] },
  jueming: { key: 'jueming', zh: '絕命', element: 'metal', rank: -4, auspicious: false, keyword: '破軍星，主重病、意外、絕嗣破財', goodFor: ['廁所', '廚房（灶座壓制）', '儲藏室'], avoid: ['大門', '臥室', '床頭朝向', '神位'] },
}

/**
 * 大遊年歌訣 — the sequence of stars for the 7 palaces clockwise after the home palace.
 * 乾六天五禍絕延生、坎五天生延絕禍六、艮六絕禍生延天五、震延生禍絕五天六、
 * 巽天五六禍生絕延、離六五絕延禍生天、坤天延絕生禍五六、兌生禍延絕六五天。
 */
const SONG: Record<Trigram, string> = {
  qian: '六天五禍絕延生',
  kan: '五天生延絕禍六',
  gen: '六絕禍生延天五',
  zhen: '延生禍絕五天六',
  xun: '天五六禍生絕延',
  li: '六五絕延禍生天',
  kun: '天延絕生禍五六',
  dui: '生禍延絕六五天',
}

const CHAR_TO_STAR: Record<string, WanderingStar> = {
  生: 'shengqi', 天: 'tianyi', 延: 'yannian', 伏: 'fuwei', 禍: 'huohai', 六: 'liusha', 五: 'wugui', 絕: 'jueming',
}

/** Wandering star of `target` palace for a house/life gua `base`. */
export function wanderingStar(base: Trigram, target: Trigram): WanderingStar {
  if (base === target) return 'fuwei'
  const bi = TRIGRAMS_CLOCKWISE.indexOf(base)
  const ti = TRIGRAMS_CLOCKWISE.indexOf(target)
  const steps = (ti - bi + 8) % 8 // 1..7
  const ch = SONG[base][steps - 1]!
  return CHAR_TO_STAR[ch]!
}

/** Full 8-palace star map for a base gua. */
export function starMap(base: Trigram): Record<Trigram, WanderingStar> {
  const out = {} as Record<Trigram, WanderingStar>
  for (const t of TRIGRAMS_CLOCKWISE) out[t] = wanderingStar(base, t)
  return out
}

const GUA_BY_NUMBER: Record<number, Trigram> = { 1: 'kan', 2: 'kun', 3: 'zhen', 4: 'xun', 6: 'qian', 7: 'dui', 8: 'gen', 9: 'li' }

/**
 * 命卦 (Life Gua). `year` must already be 立春-adjusted.
 * 男：(11 − 年份各位數字反覆相加至個位) mod 9；女：(年份數字和 + 4) mod 9。
 * 餘 0 作 9；得 5 時男為坤、女為艮。
 */
export function lifeGua(year: number, gender: Gender): Trigram {
  let s = year
  while (s > 9) s = String(s).split('').reduce((a, c) => a + Number(c), 0)
  let n = gender === 'male' ? (11 - s) % 9 : (s + 4) % 9
  if (n === 0) n = 9
  if (n === 5) return gender === 'male' ? 'kun' : 'gen'
  return GUA_BY_NUMBER[n]!
}

/** 宅卦 by sitting palace (坐山所在卦). */
export function houseGua(sittingPalace: Trigram): Trigram {
  return sittingPalace
}

export function guaGroup(g: Trigram): 'east' | 'west' {
  return PALACES[g].group === 'east' ? 'east' : 'west'
}

export function groupZh(g: 'east' | 'west'): string {
  return g === 'east' ? '東四' : '西四'
}

export interface BazhaiPersonResult {
  gua: Trigram
  group: 'east' | 'west'
  stars: Record<Trigram, WanderingStar>
  /** best 4 directions in order */
  bestDirections: Trigram[]
  worstDirections: Trigram[]
}

export function analyzePerson(year: number, gender: Gender): BazhaiPersonResult {
  const gua = lifeGua(year, gender)
  const stars = starMap(gua)
  const byStar = (k: WanderingStar) => TRIGRAMS_CLOCKWISE.find((t) => stars[t] === k)!
  return {
    gua,
    group: guaGroup(gua),
    stars,
    bestDirections: [byStar('shengqi'), byStar('tianyi'), byStar('yannian'), byStar('fuwei')],
    worstDirections: [byStar('huohai'), byStar('liusha'), byStar('wugui'), byStar('jueming')],
  }
}
