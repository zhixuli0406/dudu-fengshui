import { useState, type ReactNode } from 'react'
import { MasterAvatar } from '../components/MasterAvatar'
import { useTypewriter } from './useTypewriter'
import { cn } from '../lib/utils'

export interface SceneChoice {
  label: string
  /** what the master answers before moving on (typed out, then a single continue button) */
  reply?: string
  onPick: () => void
  primary?: boolean
}

export const choiceCls = (primary?: boolean, extra?: string) =>
  cn('w-full rounded-xl border px-4 py-3 text-center text-[15px] font-medium transition active:scale-[0.98]',
    primary ? 'border-brand bg-brand text-brand-foreground' : 'border-white/15 bg-white/[0.04] text-zinc-100', extra)

/** The way out of a question: never block, always offer a smaller step. */
export function Escape({ label, onPick }: { label: string; onPick: () => void }) {
  return <button className="mt-4 w-full py-2 text-center text-sm text-zinc-400 underline underline-offset-4" onClick={onPick}>{label}</button>
}

/**
 * Dialogue beat: the master says a few lines (tap to hurry), then choices appear.
 * Mount with a React `key` per scene so the line counter resets.
 */
export function Scene({ lines, choices, aside, name = '嘟嘟師傅' }: { lines: string[]; choices: SceneChoice[]; aside?: ReactNode; name?: string }) {
  const [i, setI] = useState(0)
  const [reply, setReply] = useState<SceneChoice | null>(null)
  const last = Math.max(0, lines.length - 1)
  const current = reply?.reply ?? lines[Math.min(i, last)] ?? ''
  const tw = useTypewriter(current)
  const allShown = i >= last && tw.done
  const tap = () => { if (!tw.done) tw.finish(); else if (!reply && i < last) setI(i + 1) }
  const shownLines = reply ? lines : lines.slice(0, Math.min(i, last))
  return (
    <div onClick={tap} className="select-none">
      <div className="mb-3 flex items-center gap-2"><MasterAvatar size={40} /><span className="text-xs tracking-[0.25em] text-brand">{name}</span></div>
      <div className="space-y-2.5 font-display text-[21px] leading-relaxed text-[#efe7d6]">
        {shownLines.map((l, k) => <p key={k} className="opacity-45">{l}</p>)}
        <p>{tw.shown}{!tw.done && <span className="guide-caret text-brand">▍</span>}</p>
      </div>
      {!allShown && !reply && <p className="mt-3 text-xs text-zinc-500">點一下繼續</p>}
      {aside && allShown && !reply && <div className="guide-fade mt-4">{aside}</div>}
      {allShown && !reply && (
        <div className="guide-fade mt-5 grid gap-2">
          {choices.map((c) => <button key={c.label} onClick={(e) => { e.stopPropagation(); if (c.reply) setReply(c); else c.onPick() }} className={choiceCls(c.primary)}>{c.label}</button>)}
        </div>
      )}
      {reply && tw.done && <div className="guide-fade mt-5"><button onClick={(e) => { e.stopPropagation(); reply.onPick() }} className={choiceCls(true)}>走吧</button></div>}
    </div>
  )
}
