import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from './mds'
import { EFFORT_DESC, EFFORT_ORDER, EFFORT_ZH, groupByEffort, type ActionItem, type Effort } from '../engine/advice'
import { cn } from '../lib/utils'

/** 一般使用者視角：依難度分四組的行動清單 */
export function ActionList({ actions }: { actions: ActionItem[] }) {
  const groups = groupByEffort(actions)
  const [open, setOpen] = useState<Record<Effort, boolean>>({ now: true, small: true, move: true, renovate: false })
  return (
    <div className="space-y-4">
      {EFFORT_ORDER.map((e, i) => {
        const items = groups[e]
        return (
          <section key={e} className="rounded-xl border border-surface-border bg-surface">
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen((o) => ({ ...o, [e]: !o[e] }))} aria-expanded={open[e]}>
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium', items.length ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground')}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{EFFORT_ZH[e]}<span className="ml-2 font-normal text-muted-foreground">{items.length} 項</span></span>
                <span className="block text-xs text-muted-foreground">{EFFORT_DESC[e]}</span>
              </span>
              <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open[e] && 'rotate-180')} />
            </button>
            {open[e] && (
              items.length === 0 ? <p className="border-t border-surface-border px-4 py-3 text-sm text-muted-foreground">這一級沒有要做的事。</p> : (
                <ol className="divide-y divide-surface-border border-t border-surface-border">
                  {items.map((a) => <ActionRow key={a.id} a={a} />)}
                </ol>
              )
            )}
          </section>
        )
      })}
    </div>
  )
}

function ActionRow({ a }: { a: ActionItem }) {
  const [more, setMore] = useState(false)
  const extra = a.how.slice(1)
  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">{a.title}</span>
        {a.priority === 1 && <Badge variant="destructive">優先</Badge>}
        {a.where && <Badge variant="ghost">{a.where}</Badge>}
        {a.contested && <Badge variant="outline">各派有別</Badge>}
      </div>
      <p className="mt-1 text-muted-foreground">{a.why}</p>
      <p className="mt-2 rounded-lg bg-brand/8 px-3 py-2"><span className="mr-1 text-xs text-brand">怎麼做</span>{a.how[0]!.text}</p>
      {extra.length > 0 && (
        <div className="mt-1.5">
          <button className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => setMore((m) => !m)}>{more ? '收起' : `更徹底的做法（${extra.length}）`}</button>
          {more && <ul className="mt-1 space-y-1 text-xs text-muted-foreground">{extra.map((h, i) => <li key={i}><Badge variant="ghost" className="mr-1">{EFFORT_ZH[h.effort]}</Badge>{h.text}</li>)}</ul>}
        </div>
      )}
    </li>
  )
}
