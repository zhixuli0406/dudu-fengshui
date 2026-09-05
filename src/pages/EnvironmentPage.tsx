import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card } from '../components/ui'
import { useAppStore } from '../store/useAppStore'
import questions from '../data/environmentQuestions.json'
import { environmentFindings, type EnvironmentQuestion } from '../engine/environment'

const QS = questions as EnvironmentQuestion[]

export function EnvironmentPage() {
  const environment = useAppStore((s) => s.environment as Record<string, string | boolean | undefined>)
  const setEnv = useAppStore((s) => s.setEnvironmentOption)
  const groups = useMemo(() => { const g = new Map<string, EnvironmentQuestion[]>(); for (const q of QS) g.set(q.group, [...(g.get(q.group) ?? []), q]); return [...g.entries()] }, [])
  const findings = useMemo(() => environmentFindings(environment, QS), [environment])
  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto safe-t">
      <div className="flex items-center justify-between pt-2">
        <h1 className="font-serif text-2xl font-bold text-gold">外局問卷</h1>
        <Badge tone={findings.length ? 'red' : 'green'}>{findings.length} 項外煞</Badge>
      </div>
      <p className="text-sm text-paper/70">屋外環境（路沖、壁刀、天斬煞、高壓電塔等）無法從平面圖判定，請就實際狀況勾選。勾選結果會併入報告的「形勢」分頁。<Link to="/report" className="text-gold underline ml-1">看報告</Link></p>
      {groups.map(([g, qs]) => (
        <Card key={g} title={g}>
          <ul className="space-y-3">
            {qs.map((q) => (
              <li key={q.id}>
                <div className="text-sm">{q.question}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {q.options.map((o) => (
                    <button key={o} onClick={() => setEnv(q.id, o)} className={`px-2 py-1 rounded-md text-xs ${environment[q.id] === o ? 'bg-gold text-ink font-semibold' : 'bg-ink text-paper/80'}`}>{o}</button>
                  ))}
                </div>
                {environment[q.id] && findings.some((f) => f.ruleId === `env_${q.id}`) && (
                  <div className="mt-1 text-xs text-paper/60">{q.explanation.slice(0, 120)}{q.explanation.length > 120 ? '…' : ''}<br /><span className="text-gold/80">化解：{q.remedy.slice(0, 100)}</span></div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}
