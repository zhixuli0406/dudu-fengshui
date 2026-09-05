import { describe, expect, it } from 'vitest'
import { fly, flyingStarChart, periodChart, periodOfYear, timeliness, zhengLingShen, isJianXiang, MOUNTAINS } from './xuankong'
import { annualCenterStar, annualChart, monthlyCenterStar, taiSui, annualAfflictions } from './annual'

describe('元運', () => {
  it('period of year', () => {
    expect(periodOfYear(2003)).toBe(7)
    expect(periodOfYear(2004)).toBe(8)
    expect(periodOfYear(2023)).toBe(8)
    expect(periodOfYear(2024)).toBe(9)
    expect(periodOfYear(2043)).toBe(9)
    expect(periodOfYear(2044)).toBe(1)
  })
  it('正零神', () => {
    expect(zhengLingShen(9)).toEqual({ zheng: 'li', ling: 'kan' })
    expect(zhengLingShen(8)).toEqual({ zheng: 'gen', ling: 'kun' })
  })
  it('timeliness', () => {
    expect(timeliness(9, 9)).toBe('wang')
    expect(timeliness(1, 9)).toBe('sheng')
    expect(timeliness(2, 9)).toBe('jin')
    expect(timeliness(8, 9)).toBe('tui')
    expect(timeliness(7, 9)).toBe('si')
    expect(timeliness(5, 9)).toBe('sha')
  })
})

describe('飛星排盤', () => {
  it('順飛：5 入中 = 洛書元旦盤', () => {
    const c = fly(5, true)
    expect(c.kan).toBe(1); expect(c.kun).toBe(2); expect(c.zhen).toBe(3); expect(c.xun).toBe(4)
    expect(c.qian).toBe(6); expect(c.dui).toBe(7); expect(c.gen).toBe(8); expect(c.li).toBe(9)
  })
  it('逆飛：5 入中', () => {
    const c = fly(5, false)
    expect(c.qian).toBe(4); expect(c.dui).toBe(3); expect(c.gen).toBe(2); expect(c.li).toBe(1)
    expect(c.kan).toBe(9); expect(c.kun).toBe(8); expect(c.zhen).toBe(7); expect(c.xun).toBe(6)
  })
  it('八運運盤', () => {
    const c = periodChart(8)
    expect(c.center).toBe(8); expect(c.qian).toBe(9); expect(c.dui).toBe(1); expect(c.gen).toBe(2)
    expect(c.li).toBe(3); expect(c.kan).toBe(4); expect(c.kun).toBe(5); expect(c.zhen).toBe(6); expect(c.xun).toBe(7)
  })
  it('八運 子山午向 → 雙星到向（88 到向）', () => {
    const ch = flyingStarChart(180, 8)
    expect(ch.sitting.name).toBe('子')
    expect(ch.facing.name).toBe('午')
    // 山盤 4 入中順飛
    expect(ch.mountainStars.center).toBe(4)
    expect(ch.mountainStars.li).toBe(8)
    expect(ch.mountainStars.kan).toBe(9)
    // 向盤 3 入中逆飛
    expect(ch.waterStars.center).toBe(3)
    expect(ch.waterStars.li).toBe(8)
    expect(ch.waterStars.kan).toBe(7)
    expect(ch.pattern).toBe('double-facing')
  })
  it('八運 午山子向 → 雙星到坐', () => {
    const ch = flyingStarChart(0, 8)
    expect(ch.sitting.name).toBe('午')
    expect(ch.facing.name).toBe('子')
    expect(ch.pattern).toBe('double-sitting')
  })
  it('八運 乾山巽向 → 旺山旺向', () => {
    const ch = flyingStarChart(135, 8)
    expect(ch.sitting.name).toBe('乾')
    expect(ch.mountainStars.qian).toBe(8)
    expect(ch.waterStars.xun).toBe(8)
    expect(ch.pattern).toBe('wangshan-wangxiang')
  })
  it('八運 巽山乾向 → 旺山旺向', () => {
    const ch = flyingStarChart(315, 8)
    expect(ch.pattern).toBe('wangshan-wangxiang')
  })
  it('八運 丑山未向 → 旺山旺向（八運六個旺山旺向之一）', () => {
    const ch = flyingStarChart(210, 8)
    expect(ch.sitting.name).toBe('丑')
    expect(ch.pattern).toBe('wangshan-wangxiang')
  })
  it('八運 艮山坤向 → 上山下水', () => {
    const ch = flyingStarChart(225, 8)
    expect(ch.sitting.name).toBe('艮')
    expect(ch.mountainStars.kun).toBe(8)
    expect(ch.waterStars.gen).toBe(8)
    expect(ch.pattern).toBe('shangshan-xiashui')
  })
  it('八運旺山旺向恰為六局：乾巽、巽乾、亥巳、巳亥、丑未、未丑', () => {
    const names = MOUNTAINS.filter((m) => flyingStarChart(m.center, 8).pattern === 'wangshan-wangxiang').map((m) => m.name)
    expect(names.sort()).toEqual(['乾', '亥', '丑', '巳', '巽', '未'].sort())
  })
  it('九運 子山午向 → 雙星到坐（5 入中依坐山陰陽）', () => {
    const ch = flyingStarChart(180, 9)
    expect(ch.periodStars.kan).toBe(5)
    expect(ch.mountainStars.center).toBe(5)
    expect(ch.mountainStars.kan).toBe(9) // 子陰逆飛
    expect(ch.waterStars.center).toBe(4)
    expect(ch.waterStars.kan).toBe(9) // 4 入中，午天元→巽陽順飛
    expect(ch.pattern).toBe('double-sitting')
  })
  it('九運 午山子向 → 雙星到向', () => {
    const ch = flyingStarChart(0, 9)
    expect(ch.pattern).toBe('double-facing')
  })
  it('九運下卦無旺山旺向、無上山下水，只有雙星到坐/到向', () => {
    for (const m of MOUNTAINS) {
      const ch = flyingStarChart(m.center, 9)
      expect(['double-sitting', 'double-facing']).toContain(ch.pattern)
    }
  })
  it('九運 乾山巽向 → 雙星到坐', () => {
    const ch = flyingStarChart(135, 9)
    expect(ch.mountainStars.qian).toBe(9)
    expect(ch.waterStars.qian).toBe(9)
    expect(ch.pattern).toBe('double-sitting')
  })
  it('兼向判定', () => {
    expect(isJianXiang(180)).toBe(false)
    expect(isJianXiang(183)).toBe(false)
    expect(isJianXiang(186)).toBe(true)
  })
})

describe('流年', () => {
  it('年飛星入中', () => {
    expect(annualCenterStar(2024)).toBe(3)
    expect(annualCenterStar(2025)).toBe(2)
    expect(annualCenterStar(2026)).toBe(1)
    expect(annualCenterStar(2027)).toBe(9)
    expect(annualCenterStar(2028)).toBe(8)
  })
  it('2026 一白入中：五黃到南、二黑到西北、三碧到西、八白到東、九紫到東南', () => {
    const c = annualChart(2026)
    expect(c.li).toBe(5)
    expect(c.qian).toBe(2)
    const a = annualAfflictions(2026)
    expect(a.wuhuang).toBe('li')
    expect(a.erhei).toBe('qian')
    expect(a.sanbi).toBe('dui')
    expect(a.babai).toBe('zhen')
    expect(a.jiuzi).toBe('xun')
    expect(a.yibai).toBe('center')
    expect(a.silv).toBe('gen')
    expect(a.liubai).toBe('kan')
    expect(a.qichi).toBe('kun')
  })
  it('月飛星', () => {
    expect(monthlyCenterStar('午', 1)).toBe(8)
    expect(monthlyCenterStar('午', 2)).toBe(7)
    expect(monthlyCenterStar('午', 12)).toBe(6)
    expect(monthlyCenterStar('辰', 1)).toBe(5)
    expect(monthlyCenterStar('寅', 1)).toBe(2)
  })
  it('2026 丙午年太歲', () => {
    const t = taiSui(2026)
    expect(t.ganzhi).toBe('丙午')
    expect(t.zodiac).toBe('馬')
    expect(t.taisuiBearing).toBe(180)
    expect(t.suipoMountain).toBe('子')
    expect(t.sanshaPalace).toBe('kan')
    expect(t.offending.map((o) => o.zodiac)).toEqual(expect.arrayContaining(['馬', '鼠', '牛', '兔']))
  })
})
