import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Page, PageHeader } from '../components/AppShell'
import { Badge, Button } from '../components/mds'
import { useAppStore } from '../store/useAppStore'
import questions from '../data/environmentQuestions.json'
import { environmentFindings, type EnvironmentQuestion } from '../engine/environment'
import { cn } from '../lib/utils'

const QS = questions as EnvironmentQuestion[]

export function EnvironmentPage() {
  const environment = useAppStore((s) => s.environment as Record<string, string | boolean | undefined>)
  const setEnv = useAppStore((s) => s.setEnvironmentOption)
  const findings = useMemo(() => environmentFindings(environment, QS), [environment])
  const answered = QS.filter((q) => environment[q.id]).length
  return (
    <>
      <PageHeader title="屋外環境" subtitle={`第 3 步，已答 ${answered} / ${QS.length}`} right={findings.length ? <Badge variant="destructive">{findings.length} 項外煞</Badge> : undefined} />
      <Page className="space-y-6">
        <p className="text-sm text-muted-foreground">屋外環境無法從平面圖判定，請就實際狀況勾選。不確定的題目可以跳過。</p>
        <ol className="space-y-5">
          {QS.map((q, i) => {
            const hit = findings.find((f) => f.ruleId === `env_${q.id}`)
            return (
              <li key={q.id} className="rounded-xl border border-surface-border bg-surface p-4">
                <div className="text-sm"><span className="mr-1 text-muted-foreground">{i + 1}.</span>{q.question}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {q.options.map((o) => (
                    <button key={o} onClick={() => setEnv(q.id, o)} className={cn('rounded-lg border px-2.5 py-1.5 text-xs transition-colors', environment[q.id] === o ? 'border-brand bg-brand/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted')}>{o}</button>
                  ))}
                </div>
                {hit && <div className="mt-2 border-t border-surface-border pt-2 text-xs text-muted-foreground">{q.explanation.slice(0, 140)}{q.explanation.length > 140 ? '…' : ''}<div className="mt-1 text-foreground">化解：{q.remedy.slice(0, 120)}</div></div>}
              </li>
            )
          })}
        </ol>
        <Link to="/report"><Button variant="brand" size="lg" className="w-full">下一步：看報告</Button></Link>
      </Page>
    </>
  )
}
