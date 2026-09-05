import { describe, expect, it } from 'vitest'
import { analyzePerson, lifeGua, starMap, wanderingStar } from './bazhai'
import { TRIGRAMS_CLOCKWISE } from './bagua'

describe('命卦', () => {
  it('公式驗證（常見對照表）', () => {
    expect(lifeGua(1984, 'male')).toBe('dui')
    expect(lifeGua(1984, 'female')).toBe('gen')
    expect(lifeGua(1990, 'male')).toBe('kan')
    expect(lifeGua(1990, 'female')).toBe('gen') // 5 → 女艮
    expect(lifeGua(1985, 'male')).toBe('qian')
    expect(lifeGua(1985, 'female')).toBe('li')
    expect(lifeGua(2000, 'male')).toBe('li')
    expect(lifeGua(2000, 'female')).toBe('qian')
    expect(lifeGua(2001, 'male')).toBe('gen')
    expect(lifeGua(2001, 'female')).toBe('dui')
    expect(lifeGua(1977, 'male')).toBe('kun') // 5 → 男坤
    expect(lifeGua(1986, 'female')).toBe('kan')
  })
})

describe('八遊星', () => {
  it('伏位為本宮', () => {
    for (const t of TRIGRAMS_CLOCKWISE) expect(wanderingStar(t, t)).toBe('fuwei')
  })
  it('乾宅：六天五禍絕延生', () => {
    const m = starMap('qian')
    expect(m.kan).toBe('liusha')
    expect(m.gen).toBe('tianyi')
    expect(m.zhen).toBe('wugui')
    expect(m.xun).toBe('huohai')
    expect(m.li).toBe('jueming')
    expect(m.kun).toBe('yannian')
    expect(m.dui).toBe('shengqi')
  })
  it('坎宅：五天生延絕禍六', () => {
    const m = starMap('kan')
    expect(m.gen).toBe('wugui')
    expect(m.zhen).toBe('tianyi')
    expect(m.xun).toBe('shengqi')
    expect(m.li).toBe('yannian')
    expect(m.kun).toBe('jueming')
    expect(m.dui).toBe('huohai')
    expect(m.qian).toBe('liusha')
  })
  it('離宅：六五絕延禍生天', () => {
    const m = starMap('li')
    expect(m.kun).toBe('liusha')
    expect(m.dui).toBe('wugui')
    expect(m.qian).toBe('jueming')
    expect(m.kan).toBe('yannian')
    expect(m.gen).toBe('huohai')
    expect(m.zhen).toBe('shengqi')
    expect(m.xun).toBe('tianyi')
  })
  it('遊星關係對稱（A 對 B 的星 = B 對 A 的星）', () => {
    for (const a of TRIGRAMS_CLOCKWISE) for (const b of TRIGRAMS_CLOCKWISE) {
      expect(wanderingStar(a, b)).toBe(wanderingStar(b, a))
    }
  })
  it('東四卦互為吉方、東西相交皆凶', () => {
    const east = ['kan', 'zhen', 'xun', 'li'] as const
    const west = ['qian', 'kun', 'gen', 'dui'] as const
    const good = new Set(['shengqi', 'tianyi', 'yannian', 'fuwei'])
    for (const a of east) for (const b of east) expect(good.has(wanderingStar(a, b))).toBe(true)
    for (const a of west) for (const b of west) expect(good.has(wanderingStar(a, b))).toBe(true)
    for (const a of east) for (const b of west) expect(good.has(wanderingStar(a, b))).toBe(false)
  })
  it('analyzePerson', () => {
    const r = analyzePerson(1990, 'male')
    expect(r.gua).toBe('kan')
    expect(r.group).toBe('east')
    expect(r.bestDirections).toEqual(['xun', 'zhen', 'li', 'kan'])
  })
})
