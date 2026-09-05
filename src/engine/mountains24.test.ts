import { describe, expect, it } from 'vitest'
import { MOUNTAINS, kongwangOf, mountainByName, mountainOf, oppositeMountain } from './mountains24'
import { palaceOfBearing, bearingOfPoint, angleDiff } from './direction'

describe('二十四山', () => {
  it('24 座山、每山 15°', () => {
    expect(MOUNTAINS).toHaveLength(24)
    expect(mountainByName('子').center).toBe(0)
    expect(mountainByName('午').center).toBe(180)
    expect(mountainByName('卯').center).toBe(90)
    expect(mountainByName('酉').center).toBe(270)
    expect(mountainByName('壬').start).toBe(337.5)
    expect(mountainByName('壬').end).toBe(352.5)
  })
  it('bearing → mountain', () => {
    expect(mountainOf(0).name).toBe('子')
    expect(mountainOf(7).name).toBe('子')
    expect(mountainOf(8).name).toBe('癸')
    expect(mountainOf(345).name).toBe('壬')
    expect(mountainOf(337.6).name).toBe('壬')
    expect(mountainOf(337.4).name).toBe('亥')
    expect(mountainOf(180).name).toBe('午')
    expect(mountainOf(172).name).toBe('丙')
    expect(mountainOf(315).name).toBe('乾')
    expect(mountainOf(135).name).toBe('巽')
  })
  it('陰陽：四正卦地元陽、天人元陰；四隅卦地元陰、天人元陽', () => {
    const y = (n: string) => mountainByName(n).yang
    expect(y('壬')).toBe(true); expect(y('子')).toBe(false); expect(y('癸')).toBe(false)
    expect(y('丑')).toBe(false); expect(y('艮')).toBe(true); expect(y('寅')).toBe(true)
    expect(y('甲')).toBe(true); expect(y('卯')).toBe(false); expect(y('乙')).toBe(false)
    expect(y('辰')).toBe(false); expect(y('巽')).toBe(true); expect(y('巳')).toBe(true)
    expect(y('丙')).toBe(true); expect(y('午')).toBe(false); expect(y('丁')).toBe(false)
    expect(y('未')).toBe(false); expect(y('坤')).toBe(true); expect(y('申')).toBe(true)
    expect(y('庚')).toBe(true); expect(y('酉')).toBe(false); expect(y('辛')).toBe(false)
    expect(y('戌')).toBe(false); expect(y('乾')).toBe(true); expect(y('亥')).toBe(true)
  })
  it('對山', () => {
    expect(oppositeMountain(mountainByName('子')).name).toBe('午')
    expect(oppositeMountain(mountainByName('乾')).name).toBe('巽')
  })
  it('空亡', () => {
    expect(kongwangOf(22.5)).toBe('major')
    expect(kongwangOf(337.5)).toBe('major')
    expect(kongwangOf(7.5)).toBe('minor')
    expect(kongwangOf(0)).toBeNull()
    expect(kongwangOf(180)).toBeNull()
  })
})

describe('方位', () => {
  it('palaceOfBearing', () => {
    expect(palaceOfBearing(0)).toBe('kan')
    expect(palaceOfBearing(22.4)).toBe('kan')
    expect(palaceOfBearing(22.5)).toBe('gen')
    expect(palaceOfBearing(90)).toBe('zhen')
    expect(palaceOfBearing(180)).toBe('li')
    expect(palaceOfBearing(315)).toBe('qian')
    expect(palaceOfBearing(359)).toBe('kan')
  })
  it('bearingOfPoint (screen y down)', () => {
    expect(bearingOfPoint(0, 0, 0, -10)).toBe(0) // up = north
    expect(bearingOfPoint(0, 0, 10, 0)).toBe(90)
    expect(bearingOfPoint(0, 0, 0, 10)).toBe(180)
    expect(bearingOfPoint(0, 0, -10, 0)).toBe(270)
    expect(bearingOfPoint(0, 0, 0, -10, 90)).toBe(90) // plan rotated
  })
  it('angleDiff', () => {
    expect(angleDiff(350, 10)).toBe(20)
    expect(angleDiff(10, 350)).toBe(-20)
  })
})
