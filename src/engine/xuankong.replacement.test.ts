import { describe, expect, it } from 'vitest'
import { REPLACEMENT_STAR, flyingStarChart, flyingStarChartFromMountains, jianxiangOffset, MOUNTAINS, periodChart, referenceMountain } from './xuankong'
import { mountainByName, oppositeMountain } from './mountains24'
import { PALACES, TRIGRAMS_CLOCKWISE, oppositePalace } from './bagua'

describe('替卦', () => {
  it('替星表涵蓋 24 山且只用 1 2 6 7 9', () => {
    expect(Object.keys(REPLACEMENT_STAR)).toHaveLength(24)
    expect(new Set(Object.values(REPLACEMENT_STAR))).toEqual(new Set([1, 2, 6, 7, 9]))
    for (const m of MOUNTAINS) expect(REPLACEMENT_STAR[m.name]).toBeDefined()
  })
  it('替而不替的 11 山：替星等於本宮數', () => {
    const same = MOUNTAINS.filter((m) => REPLACEMENT_STAR[m.name] === PALACES[m.palace].luoshu).map((m) => m.name)
    expect(same.sort()).toEqual(['子', '癸', '未', '坤', '乾', '亥', '戌', '酉', '辛', '午', '丁'].sort())
  })
  it('兼向偏角', () => {
    expect(jianxiangOffset(180)).toBe(0)
    expect(jianxiangOffset(185)).toBe(5)
    expect(jianxiangOffset(172.6)).toBeCloseTo(7.4, 5)
  })
  it('auto：偏 5° 用替卦、偏 3° 不用；never 一律下卦但標示；門檻可調', () => {
    expect(flyingStarChart(185, 9).replacement).toBe(true)
    expect(flyingStarChart(183, 9).replacement).toBe(false)
    const never = flyingStarChart(185, 9, { replacement: 'never' })
    expect(never.replacement).toBe(false)
    expect(never.patternNotes[0]).toMatch(/兼向/)
    expect(flyingStarChart(184, 9, { jianxiangTolerance: 3.5 }).replacement).toBe(true)
    expect(flyingStarChart(185, 9, { jianxiangTolerance: 6 }).replacement).toBe(false)
  })
  it('替卦運算：九運 甲山庚向兼 → 坐震運星 7，同元取山庚(地元) → 替星 9 入中順飛', () => {
    // 運盤 9：震 7、兌 2。坐甲(地元)：星 7 在兌宮，地元＝庚（陽）→ 替星 9 順飛。
    // 向庚(地元)：星 2 在坤宮，地元＝未（陰）→ 替星 2（未→2，替而不替）逆飛。
    const c = flyingStarChartFromMountains(mountainByName('甲'), mountainByName('庚'), 9, true)
    expect(c.replacementInfo).toEqual({ mountainRef: '庚', mountainStar: 9, waterRef: '未', waterStar: 2, effective: true })
    expect(c.mountainStars.center).toBe(9)
    expect(c.mountainStars.qian).toBe(1) // 順飛
    expect(c.waterStars.center).toBe(2)
    expect(c.waterStars.qian).toBe(1) // 逆飛
    // 下卦盤對照：山盤 7 入中順飛
    const d = flyingStarChartFromMountains(mountainByName('甲'), mountainByName('庚'), 9, false)
    expect(d.mountainStars.center).toBe(7)
  })
  it('同元取山', () => {
    expect(referenceMountain(7, mountainByName('甲')).name).toBe('庚')
    expect(referenceMountain(5, mountainByName('子')).name).toBe('子')
    expect(referenceMountain(1, mountainByName('乾')).name).toBe('子')
  })
  it('順逆依據不變：替卦盤與下卦盤各宮飛行方向相同', () => {
    for (let p = 1; p <= 9; p++) for (const m of MOUNTAINS) {
      const a = flyingStarChartFromMountains(m, oppositeMountain(m), p, false)
      const b = flyingStarChartFromMountains(m, oppositeMountain(m), p, true)
      const dirA = (a.mountainStars.qian - a.mountainStars.center + 9) % 9
      const dirB = (b.mountainStars.qian - b.mountainStars.center + 9) % 9
      expect(dirA).toBe(dirB)
    }
  })
})

describe('定理交叉驗證（doc 02 §2.12）', () => {
  it('定理一：山盤逆飛 ⇔ 旺山星到坐；向盤逆飛 ⇔ 旺向星到向', () => {
    for (let p = 1; p <= 9; p++) for (const m of MOUNTAINS) {
      const c = flyingStarChartFromMountains(m, oppositeMountain(m), p)
      const mReverse = (c.mountainStars.qian - c.mountainStars.center + 9) % 9 === 8
      const wReverse = (c.waterStars.qian - c.waterStars.center + 9) % 9 === 8
      expect(c.mountainStars[c.sittingPalace] === p).toBe(mReverse)
      expect(c.waterStars[c.facingPalace] === p).toBe(wReverse)
      const expected = mReverse && wReverse ? 'wangshan-wangxiang' : !mReverse && !wReverse ? 'shangshan-xiashui' : !mReverse && wReverse ? 'double-facing' : 'double-sitting'
      expect(c.pattern).toBe(expected)
    }
  })
  it('定理二：入中 5 順飛 ⇔ 伏吟；逆飛 ⇔ 反吟', () => {
    for (let p = 1; p <= 9; p++) for (const m of MOUNTAINS) {
      const c = flyingStarChartFromMountains(m, oppositeMountain(m), p)
      for (const chart of [c.mountainStars, c.waterStars]) {
        if (chart.center !== 5) continue
        const forward = chart.qian === 6
        const fuyin = TRIGRAMS_CLOCKWISE.every((t) => chart[t] === PALACES[t].luoshu)
        const fanyin = TRIGRAMS_CLOCKWISE.every((t) => chart[t] === PALACES[oppositePalace(t)].luoshu)
        expect(fuyin).toBe(forward)
        expect(fanyin).toBe(!forward)
      }
    }
  })
  it('運盤：任一運中宮 == 運', () => { for (let p = 1; p <= 9; p++) expect(periodChart(p).center).toBe(p) })
})

describe('七星打劫', () => {
  it('九運 巽山乾向（星林學苑稱離宮打劫 369）→ 判定離宮打劫、369', () => {
    const c = flyingStarChartFromMountains(mountainByName('巽'), mountainByName('乾'), 9)
    expect(c.pattern).toBe('double-facing')
    expect(c.qixing?.kind).toBe('離宮打劫（真打劫）')
    expect(c.qixing?.group).toBe('369')
  })
  it('雙星到坐不判打劫（九運 子山午向）', () => {
    const c = flyingStarChartFromMountains(mountainByName('子'), mountainByName('午'), 9)
    expect(c.pattern).toBe('double-sitting')
    expect(c.qixing).toBeUndefined()
  })
  it('掃描 216 張盤：凡判定打劫者必為雙星到向且向首在該組三宮內', () => {
    for (let p = 1; p <= 9; p++) for (const m of MOUNTAINS) {
      const c = flyingStarChartFromMountains(m, oppositeMountain(m), p)
      if (!c.qixing) continue
      expect(c.pattern).toBe('double-facing')
      const group = c.qixing.kind.startsWith('離') ? ['li', 'zhen', 'qian'] : ['kan', 'xun', 'dui']
      expect(group).toContain(c.facingPalace)
    }
  })
})
