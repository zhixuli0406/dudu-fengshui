import { LUOSHU_FLIGHT_ORDER, PALACES, TRIGRAMS_CLOCKWISE, oppositePalace, type Palace, type Trigram } from './bagua'
import { MOUNTAINS, mountainOf, mountainsOfPalace, oppositeMountain, type Mountain } from './mountains24'

/** 三元九運 periods. Boundaries follow 立春 of the start year. */
export const PERIODS: ReadonlyArray<{ period: number; start: number; end: number; yuan: '上元' | '中元' | '下元' }> = [
  { period: 1, start: 1864, end: 1883, yuan: '上元' },
  { period: 2, start: 1884, end: 1903, yuan: '上元' },
  { period: 3, start: 1904, end: 1923, yuan: '上元' },
  { period: 4, start: 1924, end: 1943, yuan: '中元' },
  { period: 5, start: 1944, end: 1963, yuan: '中元' },
  { period: 6, start: 1964, end: 1983, yuan: '中元' },
  { period: 7, start: 1984, end: 2003, yuan: '下元' },
  { period: 8, start: 2004, end: 2023, yuan: '下元' },
  { period: 9, start: 2024, end: 2043, yuan: '下元' },
  { period: 1, start: 2044, end: 2063, yuan: '上元' },
]

export function periodOfYear(year: number): number {
  const p = PERIODS.find((x) => year >= x.start && year <= x.end)
  if (p) return p.period
  // extrapolate 180-year cycle
  const base = 1864
  const idx = Math.floor((((year - base) % 180) + 180) % 180 / 20)
  return idx + 1
}

export function periodInfo(period: number) {
  return PERIODS.find((x) => x.period === period && x.start >= 1864)!
}

export type Chart = Record<Palace, number>

/**
 * 替卦（起星）替星表 — 傳統口訣（蔣大鴻傳／沈氏系統）：
 * 子癸並甲申，貪狼一路行；壬卯乙未坤，五位是巨門；乾亥辰巽巳，連戌武曲名；
 * 酉辛丑艮丙，天星說破軍；寅午庚丁上，右弼四星臨。
 * 「替而不替」：替星等於本宮數的 11 山（子癸未坤乾亥戌酉辛午丁）替了等於沒替。
 */
export const REPLACEMENT_STAR: Record<string, number> = {
  子: 1, 癸: 1, 甲: 1, 申: 1,
  壬: 2, 卯: 2, 乙: 2, 未: 2, 坤: 2,
  乾: 6, 亥: 6, 辰: 6, 巽: 6, 巳: 6, 戌: 6,
  酉: 7, 辛: 7, 丑: 7, 艮: 7, 丙: 7,
  寅: 9, 午: 9, 庚: 9, 丁: 9,
}

export interface ChartOptions {
  /** 兼向門檻（度）：沈氏 4.5、玄空館 3.5、高端風水網 6。預設 4.5。 */
  jianxiangTolerance?: number
  /** auto：兼向時自動用替卦；never：一律下卦（但仍標示兼向）；always：強制替卦 */
  replacement?: 'auto' | 'never' | 'always'
}

/** Fly a star from the centre through the Luoshu path. 順 (+1) or 逆 (−1). */
export function fly(center: number, forward: boolean): Chart {
  const chart = {} as Chart
  let n = center
  for (const p of LUOSHU_FLIGHT_ORDER) {
    chart[p] = n
    n = forward ? (n % 9) + 1 : ((n + 7) % 9) + 1
  }
  return chart
}

/** 運盤 — period star into centre, always forward. */
export function periodChart(period: number): Chart {
  return fly(period, true)
}

/**
 * Decide flight direction for a star landing at centre.
 * The star `star` came from `palace` (the sitting or facing palace); the mountain used is `m` (坐山 or 向山).
 * Rule: look at the palace whose Luoshu number is `star`, take the mountain of the same tier as `m`;
 * its 陰陽 decides 順/逆. If star === 5 (no own palace), use `m` itself.
 */
export function flightDirection(star: number, m: Mountain): boolean {
  return referenceMountain(star, m).yang
}

/** 同元取山：星所在宮中與 m 同元（地／天／人）的山；星為 5 時取 m 本身。 */
export function referenceMountain(star: number, m: Mountain): Mountain {
  if (star === 5) return m
  const palace = (Object.keys(PALACES) as Palace[]).find((k) => PALACES[k].luoshu === star) as Trigram
  return mountainsOfPalace(palace).find((x) => x.tier === m.tier)!
}

export interface FlyingStarChart {
  period: number
  sitting: Mountain
  facing: Mountain
  sittingPalace: Trigram
  facingPalace: Trigram
  periodStars: Chart
  mountainStars: Chart // 山星（坐星）
  waterStars: Chart // 向星（水星）
  /** 格局 */
  pattern: Pattern
  patternNotes: string[]
  /** 是否以替卦（起星）排盤 */
  replacement: boolean
  /** 兼向：偏離山中心度數（僅 flyingStarChart 由度數建立時有值） */
  jianxiangOffset?: number
  /** 替卦時：山／向入中星（替星）與是否「替而不替」 */
  replacementInfo?: { mountainRef: string; mountainStar: number; waterRef: string; waterStar: number; effective: boolean }
  /** 七星打劫 */
  qixing?: { kind: '離宮打劫（真打劫）' | '坎宮打劫（假打劫）'; group: string; note: string }
}

export type Pattern = 'wangshan-wangxiang' | 'shangshan-xiashui' | 'double-facing' | 'double-sitting' | 'other'

export const PATTERN_ZH: Record<Pattern, string> = {
  'wangshan-wangxiang': '旺山旺向',
  'shangshan-xiashui': '上山下水',
  'double-facing': '雙星到向',
  'double-sitting': '雙星到坐',
  other: '一般格局',
}

/** Build a flying star chart from the facing bearing (degrees) and period. */
export function flyingStarChart(facingBearing: number, period: number, opts: ChartOptions = {}): FlyingStarChart {
  const facing = mountainOf(facingBearing)
  const sitting = oppositeMountain(facing)
  const tol = opts.jianxiangTolerance ?? 4.5
  const offset = jianxiangOffset(facingBearing)
  const jian = offset > tol
  const mode = opts.replacement ?? 'auto'
  const useReplacement = mode === 'always' || (mode === 'auto' && jian)
  const chart = flyingStarChartFromMountains(sitting, facing, period, useReplacement)
  chart.jianxiangOffset = Math.round(offset * 10) / 10
  if (jian && !useReplacement) chart.patternNotes.unshift(`兼向：偏離${facing.name}山中心 ${chart.jianxiangOffset}°（門檻 ${tol}°），依傳統須用替卦起星，目前以下卦排盤，結果僅供參考。`)
  return chart
}

/** 偏離山中心的角度（0–7.5）。 */
export function jianxiangOffset(facingBearing: number): number {
  const m = mountainOf(facingBearing)
  let d = Math.abs(((facingBearing % 360) + 360) % 360 - m.center)
  return Math.min(d, 360 - d)
}

export function flyingStarChartFromMountains(sitting: Mountain, facing: Mountain, period: number, replacement = false): FlyingStarChart {
  const periodStars = periodChart(period)
  const sittingPalace = sitting.palace
  const facingPalace = facing.palace

  const sittingStar = periodStars[sittingPalace]
  const facingStar = periodStars[facingPalace]
  const sitRef = referenceMountain(sittingStar, sitting)
  const faceRef = referenceMountain(facingStar, facing)
  // 替卦：入中數改用同元取山的替星；順逆仍依該山陰陽
  const mCenter = replacement ? REPLACEMENT_STAR[sitRef.name]! : sittingStar
  const wCenter = replacement ? REPLACEMENT_STAR[faceRef.name]! : facingStar
  const mountainStars = fly(mCenter, sitRef.yang)
  const waterStars = fly(wCenter, faceRef.yang)
  const replacementInfo = replacement
    ? { mountainRef: sitRef.name, mountainStar: mCenter, waterRef: faceRef.name, waterStar: wCenter, effective: mCenter !== sittingStar || wCenter !== facingStar }
    : undefined

  const notes: string[] = []
  const mAtSit = mountainStars[sittingPalace]
  const mAtFace = mountainStars[facingPalace]
  const wAtSit = waterStars[sittingPalace]
  const wAtFace = waterStars[facingPalace]
  let pattern: Pattern = 'other'
  if (mAtSit === period && wAtFace === period) {
    pattern = 'wangshan-wangxiang'
    notes.push('旺山旺向：當運山星到坐、當運向星到向，丁財兩旺，坐後宜有實牆或靠山、向前宜開闊或見水。')
  } else if (mAtFace === period && wAtSit === period) {
    pattern = 'shangshan-xiashui'
    notes.push('上山下水：山星上向、向星落坐，主損丁破財；需坐後見水、向前見山方能反轉，室內宜以擺設補救。')
  } else if (mAtFace === period && wAtFace === period) {
    pattern = 'double-facing'
    notes.push('雙星到向：當運山、向星同到向方，旺財但丁氣較弱；向方宜見水後有山（先水後山）。')
  } else if (mAtSit === period && wAtSit === period) {
    pattern = 'double-sitting'
    notes.push('雙星到坐：當運山、向星同到坐方，旺丁但財氣較弱；坐後宜先有水再有山。')
  }

  // 合十
  const heshi = TRIGRAMS_CLOCKWISE.every((p) => mountainStars[p] + periodStars[p] === 10)
    || TRIGRAMS_CLOCKWISE.every((p) => waterStars[p] + periodStars[p] === 10)
  if (heshi) notes.push('合十格：山星或向星與運星各宮皆合十，主吉，補足格局不足。')

  // 伏吟 / 反吟
  const fuyin = TRIGRAMS_CLOCKWISE.every((p) => mountainStars[p] === PALACES[p].luoshu)
    || TRIGRAMS_CLOCKWISE.every((p) => waterStars[p] === PALACES[p].luoshu)
  if (fuyin) notes.push('伏吟：山星或向星與洛書元旦盤相同，主停滯、事事不順，需以動態擺設化解。')
  const fanyin = TRIGRAMS_CLOCKWISE.every((p) => mountainStars[p] === PALACES[oppositePalace(p)].luoshu)
    || TRIGRAMS_CLOCKWISE.every((p) => waterStars[p] === PALACES[oppositePalace(p)].luoshu)
  if (fanyin) notes.push('反吟：山星或向星全盤與元旦盤相反，主變動與反覆，宜守不宜攻。')

  // 三般卦
  const set = new Set<string>()
  for (const p of [...TRIGRAMS_CLOCKWISE, 'center' as const]) {
    set.add([periodStars[p], mountainStars[p], waterStars[p]].sort().join(''))
  }
  const parent = ['147', '258', '369']
  if (set.size === 1 && [...set].every((s) => parent.includes(s))) notes.push('父母三般卦：每宮運山向皆為 147 / 258 / 369 組合，格局奇特，需配合外局。')
  const lianzhu = [...set].every((s) => { const d = s.split('').map(Number); return d[1]! - d[0]! === 1 && d[2]! - d[1]! === 1 })
    || [...set].every((s) => s === '912' || s === '891')
  if (set.size === 1 && lianzhu) notes.push('連珠三般卦：每宮三星連號。一派稱吉，中州派稱「連茹格」大凶，各派有別。')

  if (replacementInfo) {
    notes.unshift(replacementInfo.effective
      ? `替卦起星：山盤以${replacementInfo.mountainRef}替星 ${replacementInfo.mountainStar} 入中、向盤以${replacementInfo.waterRef}替星 ${replacementInfo.waterStar} 入中（傳統蔣大鴻／沈氏替星表）。替卦星辰不固，效果不若下卦穩定。`
      : `兼向但「替而不替」：${replacementInfo.mountainRef}／${replacementInfo.waterRef} 的替星即本宮數，盤面與下卦相同。`)
  }

  const qixing = detectQixing(periodStars, mountainStars, waterStars, period, facingPalace, fuyin)
  if (qixing) notes.push(`${qixing.kind}：離／震／乾（或坎／巽／兌）三宮山向星皆屬 ${qixing.group} 三般卦，且當運雙星會於該宮。${qixing.note}`)

  return {
    period, sitting, facing, sittingPalace, facingPalace,
    periodStars, mountainStars, waterStars, pattern, patternNotes: notes,
    replacement, replacementInfo, qixing,
  }
}

const SANBAN = [[1, 4, 7], [2, 5, 8], [3, 6, 9]] as const

/**
 * 七星打劫（沈氏／中州派）：當運雙星會於離宮（真打劫）或坎宮（假打劫，中州派不承認），
 * 且該宮與同組兩宮（離震乾／坎巽兌）之山星、向星各屬同一三般卦，且不犯伏吟。
 * 生效仍以巒頭（三宮通氣、外形空缺）為條件，本判定僅為盤面條件。
 */
export function detectQixing(periodStars: Chart, mountainStars: Chart, waterStars: Chart, period: number, facingPalace: Trigram, fuyin: boolean): FlyingStarChart['qixing'] | undefined {
  void periodStars
  if (fuyin) return undefined
  const groups: [Trigram[], '離宮打劫（真打劫）' | '坎宮打劫（假打劫）'][] = [[['li', 'zhen', 'qian'], '離宮打劫（真打劫）'], [['kan', 'xun', 'dui'], '坎宮打劫（假打劫）']]
  for (const [pals, kind] of groups) {
    const head = pals[0]!
    if (mountainStars[head] !== period || waterStars[head] !== period) continue
    const inSame = (vals: number[]) => SANBAN.find((g) => vals.every((v) => (g as readonly number[]).includes(v)))
    const gm = inSame(pals.map((p) => mountainStars[p]))
    const gw = inSame(pals.map((p) => waterStars[p]))
    if (!gm || !gw || gm !== gw) continue
    const note = kind.startsWith('離') ? '主提前劫取三元旺氣，三宮宜通氣作門路、臥室、廚房，外形宜空缺不可填實；各派判定條件不一。' : '中州派不承認坎宮打劫，僅供參考。'
    return { kind, group: gm.join(''), note: facingPalace === head ? note : `向首不在${head === 'li' ? '離' : '坎'}宮（較寬鬆判法）。${note}` }
  }
  return undefined
}

/** Whether the facing bearing is 兼向 (more than `tol` degrees from the mountain centre). */
export function isJianXiang(facingBearing: number, tol = 4.5): boolean {
  const m = mountainOf(facingBearing)
  let d = Math.abs(((facingBearing % 360) + 360) % 360 - m.center)
  d = Math.min(d, 360 - d)
  return d > tol
}

/** 正神 / 零神 for a period. */
export function zhengLingShen(period: number): { zheng: Trigram; ling: Trigram } {
  const zheng = (Object.keys(PALACES) as Palace[]).find((k) => PALACES[k].luoshu === period) as Trigram
  return { zheng, ling: oppositePalace(zheng) }
}

/** Star "timeliness" for a period. 死氣／煞氣的分界各派不同（五分法與七分法相反），本程式採：退 −1、死 −2、其餘為煞。 */
export type Timeliness = 'wang' | 'sheng' | 'jin' | 'tui' | 'si' | 'sha'
export const TIMELINESS_ZH: Record<Timeliness, string> = { wang: '旺氣', sheng: '生氣', jin: '進氣', tui: '退氣', si: '死氣', sha: '煞氣' }

export function timeliness(star: number, period: number): Timeliness {
  const d = ((star - period) % 9 + 9) % 9
  if (d === 0) return 'wang'
  if (d === 1) return 'sheng'
  if (d === 2) return 'jin'
  if (d === 8) return 'tui'
  if (d === 7) return 'si'
  return 'sha'
}

export { MOUNTAINS }
