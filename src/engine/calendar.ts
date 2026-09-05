import { Solar } from 'lunar-typescript'

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const
export const ZODIAC = ['鼠', '牛', '虎', '兔', '龍', '蛇', '馬', '羊', '猴', '雞', '狗', '豬'] as const
export type Branch = (typeof BRANCHES)[number]

export interface FengshuiYear {
  /** 以立春為界的年份（例：2026-02-03 → 2025） */
  year: number
  stem: string
  branch: Branch
  ganzhi: string
  zodiac: string
  /** 該年立春時刻 (local) */
  lichun: Date
}

/** Year by 立春 boundary — the convention used by 八宅 and 玄空 flying stars. */
export function fengshuiYearOf(date: Date): FengshuiYear {
  const solar = Solar.fromYmdHms(
    date.getFullYear(), date.getMonth() + 1, date.getDate(),
    date.getHours(), date.getMinutes(), date.getSeconds(),
  )
  const lunar = solar.getLunar()
  const ganzhi = lunar.getYearInGanZhiByLiChun()
  const stem = ganzhi[0]!
  const branch = ganzhi[1] as Branch
  const bi = BRANCHES.indexOf(branch)
  // Determine the numeric year: the 立春 of the calendar year, compare with date.
  const lichunThis = lichunOf(date.getFullYear())
  const year = date.getTime() >= lichunThis.getTime() ? date.getFullYear() : date.getFullYear() - 1
  return { year, stem, branch, ganzhi, zodiac: ZODIAC[bi]!, lichun: lichunOf(year) }
}

/** 立春 instant of a given Gregorian year. */
export function lichunOf(year: number): Date {
  const table = Solar.fromYmd(year, 6, 1).getLunar().getJieQiTable()
  const s = table['立春']!
  return new Date(s.getYear(), s.getMonth() - 1, s.getDay(), s.getHour(), s.getMinute(), s.getSecond())
}

/** 干支 for a year number (year already 立春-adjusted). */
export function ganzhiOfYear(year: number): { stem: string; branch: Branch; zodiac: string } {
  const si = (((year - 4) % 10) + 10) % 10
  const bi = (((year - 4) % 12) + 12) % 12
  return { stem: STEMS[si]!, branch: BRANCHES[bi]!, zodiac: ZODIAC[bi]! }
}

/** Birth year adjusted by 立春: someone born 1990-01-20 counts as 1989. */
export function birthYearByLichun(birth: Date): number {
  return fengshuiYearOf(birth).year
}
