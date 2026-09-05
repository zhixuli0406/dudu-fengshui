import type { Affect, Finding, Severity } from './rules/types'

export interface EnvironmentQuestion {
  id: string
  group: string
  question: string
  options: string[]
  severity: string
  affects: string
  explanation: string
  remedy: string
  source: string
}

const NEGATIVE = /^(無|沒有|否|不確定|不適用|無彎曲|無明顯|正常|無異常)/

function toSeverity(s: string): Severity {
  if (s.includes('高')) return 'high'
  if (s.includes('中')) return 'medium'
  return 'low'
}

function toAffects(s: string): Affect[] {
  const map: [RegExp, Affect][] = [[/健康|血光|意外/, '健康'], [/財/, '財運'], [/婚姻|感情|桃花/, '婚姻感情'], [/事業|官/, '事業'], [/學業|文昌/, '學業'], [/人際|口舌|是非/, '人際'], [/子女|子嗣/, '子女'], [/安全|意外/, '安全']]
  const out: Affect[] = []
  for (const [re, a] of map) if (re.test(s) && !out.includes(a)) out.push(a)
  return out.length ? out : ['健康']
}

/** Whether the chosen option counts as "present" (any option other than none/unsure). */
export function isPositiveAnswer(option: string | undefined): boolean {
  if (!option) return false
  return !NEGATIVE.test(option.trim()) && !/吉/.test(option)
}

/** Convert questionnaire answers into report findings (外局). */
export function environmentFindings(answers: Record<string, string | boolean | undefined>, questions: EnvironmentQuestion[]): Finding[] {
  const out: Finding[] = []
  for (const q of questions) {
    const a = answers[q.id]
    const opt = typeof a === 'boolean' ? (a ? q.options[1] ?? '有' : undefined) : a
    if (!isPositiveAnswer(opt)) continue
    const sev = toSeverity(q.severity)
    const lower = /距離 50 公尺以上|遠|輕微/.test(opt ?? '')
    out.push({
      ruleId: `env_${q.id}`,
      name: `外局：${q.question.replace(/[？?]$/, '').slice(0, 28)}${q.question.length > 28 ? '…' : ''}（${opt}）`,
      category: '格局',
      severity: lower ? (sev === 'high' ? 'medium' : 'low') : sev,
      affects: toAffects(q.affects),
      explanation: q.explanation,
      remedies: q.remedy.split(/[；;]|、(?=[^）]*$)|\s\d\s?/).map((r) => r.replace(/^[①②③④⑤⑥⑦]/, '').trim()).filter(Boolean).slice(0, 5),
      itemIds: [],
      roomIds: [],
      source: q.source,
      contested: /各派|分歧|未驗證/.test(q.explanation),
    })
  }
  return out
}
