/**
 * 對照公開盤面的迴歸測試（來源見 docs/research/02-xuankong-flying-star.md §8.9–8.10）。
 * 每宮 [山星, 向星, 運星]。
 */
import { describe, expect, it } from 'vitest'
import { flyingStarChartFromMountains, periodChart, MOUNTAINS, fly } from './xuankong'
import { mountainByName, oppositeMountain } from './mountains24'
import { annualCenterStar, annualChart, monthlyCenterStar, taiSui } from './annual'
import { TRIGRAMS_CLOCKWISE, type Palace } from './bagua'

type Expect = Record<Palace, [number, number, number]>
const chart = (sit: string, period: number) => flyingStarChartFromMountains(mountainByName(sit), oppositeMountain(mountainByName(sit)), period)
const check = (sit: string, period: number, exp: Expect) => {
  const c = chart(sit, period)
  for (const p of Object.keys(exp) as Palace[]) {
    const [m, w, r] = exp[p]
    expect([p, c.mountainStars[p], c.waterStars[p], c.periodStars[p]]).toEqual([p, m, w, r])
  }
  return c
}

describe('公開盤面對照', () => {
  it('A：九運 子山午向（vocus.cc）→ 雙星到坐、山盤反吟', () => {
    const c = check('子', 9, { xun: [6, 3, 8], li: [1, 8, 4], kun: [8, 1, 6], zhen: [7, 2, 7], center: [5, 4, 9], dui: [3, 6, 2], gen: [2, 7, 3], kan: [9, 9, 5], qian: [4, 5, 1] })
    expect(c.pattern).toBe('double-sitting')
    expect(c.patternNotes.some((n) => n.startsWith('反吟'))).toBe(true)
  })
  it('B：九運 巽山乾向（星林學苑）→ 雙星到向、向星合十', () => {
    const c = check('巽', 9, { xun: [7, 2, 8], li: [3, 6, 4], kun: [5, 4, 6], zhen: [6, 3, 7], center: [8, 1, 9], dui: [1, 8, 2], gen: [2, 7, 3], kan: [4, 5, 5], qian: [9, 9, 1] })
    expect(c.pattern).toBe('double-facing')
    expect(c.patternNotes.some((n) => n.startsWith('合十'))).toBe(true)
  })
  it('C：九運 乾山巽向（靈匣網「乾 99 一」）→ 雙星到坐、山星合十', () => {
    const c = check('乾', 9, { xun: [2, 7, 8], li: [6, 3, 4], kun: [4, 5, 6], zhen: [3, 6, 7], center: [1, 8, 9], dui: [8, 1, 2], gen: [7, 2, 3], kan: [5, 4, 5], qian: [9, 9, 1] })
    expect(c.pattern).toBe('double-sitting')
    expect(c.patternNotes.some((n) => n.startsWith('合十'))).toBe(true)
  })
  it('D：八運 乾山巽向（星林學苑，27 數全對）→ 旺山旺向', () => {
    const c = check('乾', 8, { xun: [1, 8, 7], li: [5, 3, 3], kun: [3, 1, 5], zhen: [2, 9, 6], center: [9, 7, 8], dui: [7, 5, 1], gen: [6, 4, 2], kan: [4, 2, 4], qian: [8, 6, 9] })
    expect(c.pattern).toBe('wangshan-wangxiang')
  })
})

describe('結構不變量', () => {
  const ALL: Palace[] = ['center', ...TRIGRAMS_CLOCKWISE]
  const isPerm = (c: Record<Palace, number>) => new Set(ALL.map((p) => c[p])).size === 9
  it('排列不變量：任一運、任一坐山，運／山／向盤皆為 1..9 排列（216 張盤）', () => {
    for (let p = 1; p <= 9; p++) for (const m of MOUNTAINS) {
      const c = chart(m.name, p)
      expect(isPerm(c.periodStars)).toBe(true)
      expect(isPerm(c.mountainStars)).toBe(true)
      expect(isPerm(c.waterStars)).toBe(true)
    }
  })
  it('鏡像不變量：坐向對調時山盤與向盤互換', () => {
    for (let p = 1; p <= 9; p++) for (const m of MOUNTAINS) {
      const a = chart(m.name, p), b = chart(oppositeMountain(m).name, p)
      expect(a.mountainStars).toEqual(b.waterStars)
      expect(a.waterStars).toEqual(b.mountainStars)
    }
  })
  it('天人兩元同盤：子/癸、艮/寅、卯/乙… 下卦盤相同', () => {
    const pairs: [string, string][] = [['子', '癸'], ['艮', '寅'], ['卯', '乙'], ['巽', '巳'], ['午', '丁'], ['坤', '申'], ['酉', '辛'], ['乾', '亥']]
    for (let p = 1; p <= 9; p++) for (const [a, b] of pairs) {
      expect(chart(a, p).mountainStars).toEqual(chart(b, p).mountainStars)
      expect(chart(a, p).waterStars).toEqual(chart(b, p).waterStars)
    }
  })
  it('運盤恆等：中宮 == 運且順飛', () => {
    for (let p = 1; p <= 9; p++) expect(periodChart(p)).toEqual(fly(p, true))
  })
  it('5-5 組合在 216 張盤中從未同宮', () => {
    for (let p = 1; p <= 9; p++) for (const m of MOUNTAINS) {
      const c = chart(m.name, p)
      for (const pal of ALL) expect(c.mountainStars[pal] === 5 && c.waterStars[pal] === 5).toBe(false)
    }
  })
})

describe('年月飛星（§8.10 斷言）', () => {
  it('2023–2027 年星、三元不影響', () => {
    expect([2023, 2024, 2025, 2026, 2027].map(annualCenterStar)).toEqual([4, 3, 2, 1, 9])
    expect([1864, 1924, 1984].map(annualCenterStar)).toEqual([1, 4, 7])
  })
  it('2024 年盤：震1 巽2 離7 坤9 兌5 乾4 坎8 艮6 中3', () => {
    const c = annualChart(2024)
    expect([c.zhen, c.xun, c.li, c.kun, c.dui, c.qian, c.kan, c.gen, c.center]).toEqual([1, 2, 7, 9, 5, 4, 8, 6, 3])
  })
  it('2026 五黃在離、2027 五黃在坎', () => {
    expect(annualChart(2026).li).toBe(5)
    expect(annualChart(2027).kan).toBe(5)
  })
  it('月星：午年正月 8、八月 1（與 2026 年星重合）；未年 5；巳年 2', () => {
    expect(monthlyCenterStar('午', 1)).toBe(8)
    expect(monthlyCenterStar('午', 8)).toBe(1)
    expect(monthlyCenterStar('未', 1)).toBe(5)
    expect(monthlyCenterStar('巳', 1)).toBe(2)
  })
  it('三煞／歲破／犯太歲', () => {
    expect(taiSui(2026).sanshaBranches).toEqual(['亥', '子', '丑'])
    expect(taiSui(2027).sanshaBranches).toEqual(['申', '酉', '戌'])
    expect(taiSui(2026).suipoMountain).toBe('子')
    expect(taiSui(2027).suipoMountain).toBe('丑')
    expect(new Set(taiSui(2026).offending.map((o) => o.zodiac))).toEqual(new Set(['馬', '鼠', '牛', '兔']))
  })
})
