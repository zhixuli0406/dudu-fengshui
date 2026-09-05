import type { Trigram } from './bagua'

/**
 * 二十四山 (24 Mountains). Each mountain spans 15°.
 * Degrees are compass bearings (clockwise from north) using 地盤正針.
 * `tier` = 地元 / 天元 / 人元 (Earth / Heaven / Human "dragon").
 * `yang` = 陽 (順飛) or 陰 (逆飛) for 玄空 flying star.
 *
 * Rule: 四正卦 (坎離震兌) 地元陽、天元陰、人元陰；四隅卦 (艮巽坤乾) 地元陰、天元陽、人元陽。
 */
export type Tier = 'earth' | 'heaven' | 'human'

export interface Mountain {
  index: number // 0..23 starting from 壬
  name: string
  palace: Trigram
  tier: Tier
  yang: boolean
  /** centre bearing in degrees */
  center: number
  start: number
  end: number
}

const ORDER: Array<[string, Trigram, Tier]> = [
  ['壬', 'kan', 'earth'], ['子', 'kan', 'heaven'], ['癸', 'kan', 'human'],
  ['丑', 'gen', 'earth'], ['艮', 'gen', 'heaven'], ['寅', 'gen', 'human'],
  ['甲', 'zhen', 'earth'], ['卯', 'zhen', 'heaven'], ['乙', 'zhen', 'human'],
  ['辰', 'xun', 'earth'], ['巽', 'xun', 'heaven'], ['巳', 'xun', 'human'],
  ['丙', 'li', 'earth'], ['午', 'li', 'heaven'], ['丁', 'li', 'human'],
  ['未', 'kun', 'earth'], ['坤', 'kun', 'heaven'], ['申', 'kun', 'human'],
  ['庚', 'dui', 'earth'], ['酉', 'dui', 'heaven'], ['辛', 'dui', 'human'],
  ['戌', 'qian', 'earth'], ['乾', 'qian', 'heaven'], ['亥', 'qian', 'human'],
]

const CARDINAL: ReadonlySet<Trigram> = new Set(['kan', 'li', 'zhen', 'dui'])

export const MOUNTAINS: readonly Mountain[] = ORDER.map(([name, palace, tier], i) => {
  const center = (i * 15 + 345) % 360 // 壬 centre at 345°, 子 at 0°
  const cardinal = CARDINAL.has(palace)
  const yang = cardinal ? tier === 'earth' : tier !== 'earth'
  return {
    index: i,
    name,
    palace,
    tier,
    yang,
    center,
    start: (center - 7.5 + 360) % 360,
    end: (center + 7.5) % 360,
  }
})

export function mountainByName(name: string): Mountain {
  const m = MOUNTAINS.find((x) => x.name === name)
  if (!m) throw new Error(`unknown mountain ${name}`)
  return m
}

/** Mountain containing a bearing. */
export function mountainOf(bearing: number): Mountain {
  const b = ((bearing % 360) + 360) % 360
  // shift so 壬 starts at 0: 壬 starts at 337.5
  const idx = Math.floor((((b - 337.5) % 360) + 360) % 360 / 15) % 24
  return MOUNTAINS[idx]!
}

/** Mountains of a palace in clockwise order (地元, 天元, 人元). */
export function mountainsOfPalace(p: Trigram): Mountain[] {
  return MOUNTAINS.filter((m) => m.palace === p)
}

/** Opposite mountain (對山) — the one 180° away. */
export function oppositeMountain(m: Mountain): Mountain {
  return MOUNTAINS[(m.index + 12) % 24]!
}

/**
 * 空亡 check. 大空亡 = the 8 palace boundaries (22.5°, 67.5°, …);
 * 小空亡 = the remaining 16 mountain boundaries. Tolerance in degrees.
 */
export function kongwangOf(bearing: number, tol = 1.5): 'major' | 'minor' | null {
  const b = ((bearing % 360) + 360) % 360
  for (let k = 0; k < 24; k++) {
    const boundary = (337.5 + k * 15) % 360
    let d = Math.abs(b - boundary)
    d = Math.min(d, 360 - d)
    if (d <= tol) return k % 3 === 0 ? 'major' : 'minor'
  }
  return null
}
