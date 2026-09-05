import { PALACES, TRIGRAMS_CLOCKWISE, type Palace, type Trigram } from './bagua'
import { fly, type Chart } from './xuankong'
import { BRANCHES, ganzhiOfYear, type Branch } from './calendar'

/** 年飛星入中：(11 − year mod 9) mod 9，餘 0 作 9。2024 → 3、2025 → 2、2026 → 1、2027 → 9。 */
export function annualCenterStar(year: number): number {
  let n = (11 - (year % 9)) % 9
  if (n <= 0) n += 9
  return n
}

export function annualChart(year: number): Chart {
  return fly(annualCenterStar(year), true)
}

/**
 * 月飛星入中（農曆月，正月=1，以節氣為界）：
 * 子午卯酉年正月八白、辰戌丑未年正月五黃、寅申巳亥年正月二黑，之後逐月遞減。
 */
export function monthlyCenterStar(yearBranch: Branch, lunarMonth: number): number {
  const group1 = ['子', '午', '卯', '酉']
  const group2 = ['辰', '戌', '丑', '未']
  const start = group1.includes(yearBranch) ? 8 : group2.includes(yearBranch) ? 5 : 2
  let n = ((start - (lunarMonth - 1)) % 9 + 9) % 9
  if (n === 0) n = 9
  return n
}

export function monthlyChart(yearBranch: Branch, lunarMonth: number): Chart {
  return fly(monthlyCenterStar(yearBranch, lunarMonth), true)
}

/** 地支所屬方位（以二十四山中心角度） */
export const BRANCH_BEARING: Record<Branch, number> = {
  子: 0, 丑: 30, 寅: 60, 卯: 90, 辰: 120, 巳: 150, 午: 180, 未: 210, 申: 240, 酉: 270, 戌: 300, 亥: 330,
}

export interface TaiSuiInfo {
  year: number
  ganzhi: string
  zodiac: string
  branch: Branch
  /** 太歲方位（地支所在山） */
  taisuiBearing: number
  taisuiMountain: string
  /** 歲破 */
  suipoBearing: number
  suipoMountain: string
  /** 三煞：三個地支 */
  sanshaBranches: Branch[]
  sanshaPalace: Trigram
  /** 犯太歲生肖 */
  offending: { zodiac: string; type: '值' | '沖' | '刑' | '害' | '破' }[]
}

const ZODIAC_OF: Record<Branch, string> = { 子: '鼠', 丑: '牛', 寅: '虎', 卯: '兔', 辰: '龍', 巳: '蛇', 午: '馬', 未: '羊', 申: '猴', 酉: '雞', 戌: '狗', 亥: '豬' }

/** 三煞：申子辰年煞南（巳午未）、寅午戌年煞北（亥子丑）、亥卯未年煞西（申酉戌）、巳酉丑年煞東（寅卯辰）。 */
function sansha(branch: Branch): { branches: Branch[]; palace: Trigram } {
  if (['申', '子', '辰'].includes(branch)) return { branches: ['巳', '午', '未'], palace: 'li' }
  if (['寅', '午', '戌'].includes(branch)) return { branches: ['亥', '子', '丑'], palace: 'kan' }
  if (['亥', '卯', '未'].includes(branch)) return { branches: ['申', '酉', '戌'], palace: 'dui' }
  return { branches: ['寅', '卯', '辰'], palace: 'zhen' }
}

/** 相刑表（自刑：辰午酉亥） */
const XING: Record<Branch, Branch[]> = {
  子: ['卯'], 卯: ['子'], 丑: ['戌', '未'], 戌: ['丑', '未'], 未: ['丑', '戌'],
  寅: ['巳', '申'], 巳: ['寅', '申'], 申: ['寅', '巳'], 辰: ['辰'], 午: ['午'], 酉: ['酉'], 亥: ['亥'],
}
/** 六害 */
const HAI: Record<Branch, Branch> = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' }
/** 六破 */
const PO: Record<Branch, Branch> = { 子: '酉', 酉: '子', 丑: '辰', 辰: '丑', 寅: '亥', 亥: '寅', 卯: '午', 午: '卯', 巳: '申', 申: '巳', 未: '戌', 戌: '未' }

export function taiSui(year: number): TaiSuiInfo {
  const { stem, branch, zodiac } = ganzhiOfYear(year)
  const bi = BRANCHES.indexOf(branch)
  const suipo = BRANCHES[(bi + 6) % 12]!
  const ss = sansha(branch)
  const offending: TaiSuiInfo['offending'] = [{ zodiac: ZODIAC_OF[branch], type: '值' }, { zodiac: ZODIAC_OF[suipo], type: '沖' }]
  for (const x of XING[branch]) if (x !== branch) offending.push({ zodiac: ZODIAC_OF[x], type: '刑' })
  if (XING[branch].includes(branch)) offending[0] = { zodiac: ZODIAC_OF[branch], type: '值' }
  offending.push({ zodiac: ZODIAC_OF[HAI[branch]], type: '害' })
  offending.push({ zodiac: ZODIAC_OF[PO[branch]], type: '破' })
  return {
    year, ganzhi: stem + branch, zodiac, branch,
    taisuiBearing: BRANCH_BEARING[branch], taisuiMountain: branch,
    suipoBearing: BRANCH_BEARING[suipo], suipoMountain: suipo,
    sanshaBranches: ss.branches, sanshaPalace: ss.palace,
    offending,
  }
}

export interface AnnualAfflictions {
  year: number
  chart: Chart
  wuhuang: Trigram | 'center'
  erhei: Trigram | 'center'
  sanbi: Trigram | 'center'
  qichi: Trigram | 'center'
  /** 吉星 */
  yibai: Trigram | 'center'
  silv: Trigram | 'center'
  liubai: Trigram | 'center'
  babai: Trigram | 'center'
  jiuzi: Trigram | 'center'
  taisui: TaiSuiInfo
}

function palaceOfStar(chart: Chart, star: number): Palace {
  return (['center', ...TRIGRAMS_CLOCKWISE] as Palace[]).find((p) => chart[p] === star)!
}

export function annualAfflictions(year: number): AnnualAfflictions {
  const chart = annualChart(year)
  return {
    year, chart,
    wuhuang: palaceOfStar(chart, 5), erhei: palaceOfStar(chart, 2), sanbi: palaceOfStar(chart, 3), qichi: palaceOfStar(chart, 7),
    yibai: palaceOfStar(chart, 1), silv: palaceOfStar(chart, 4), liubai: palaceOfStar(chart, 6), babai: palaceOfStar(chart, 8), jiuzi: palaceOfStar(chart, 9),
    taisui: taiSui(year),
  }
}

export function palaceLabel(p: Palace): string {
  return p === 'center' ? '中宮' : `${PALACES[p].zh}（${PALACES[p].direction}）`
}
