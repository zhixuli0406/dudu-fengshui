import type { Point } from '../geometry'

export type Severity = 'high' | 'medium' | 'low'
export type Affect = '健康' | '財運' | '婚姻感情' | '事業' | '學業' | '人際' | '子女' | '安全'
export type Category = '門' | '床' | '廚房' | '廁所' | '客廳' | '書房' | '神位' | '樑柱' | '樓梯' | '鏡' | '窗' | '格局'

export interface Finding {
  ruleId: string
  name: string
  category: Category
  severity: Severity
  affects: Affect[]
  explanation: string
  remedies: string[]
  /** related items / rooms for highlighting */
  itemIds: string[]
  roomIds: string[]
  /** optional line/points to draw on the plan */
  marks?: Point[]
  /** whether the rule is contested between schools */
  contested?: boolean
  /** short source note */
  source?: string
  /** floor name (multi-floor plans) */
  floor?: string
}

export const SEVERITY_ZH: Record<Severity, string> = { high: '高', medium: '中', low: '低' }
export const SEVERITY_WEIGHT: Record<Severity, number> = { high: 12, medium: 6, low: 2 }
