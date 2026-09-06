import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, List, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { buildReport } from '../engine/report'
import { mainFloor } from '../engine/floorplan'
import { NINE_STARS } from '../engine/stars'
import { buildChapters, type Chapter } from '../story/chapters'
import type { House3D } from '../story/house3d'
import { MasterAvatar } from '../components/MasterAvatar'
import { Button } from '../components/mds'
import { cn } from '../lib/utils'
import type { Trigram } from '../engine/bagua'

const MASTER = '嘟嘟師傅'

export function StoryPage() {
  const { persons, house, plan, floors } = useAppStore()
  const nav = useNavigate()
  const activePlan = mainFloor(floors.length ? floors : [plan])
  const report = useMemo(() => { try { return buildReport(persons, { facingBearing: house.facingBearing, periodYear: house.periodYear, plan: activePlan, floors: floors.length ? floors : [plan], stoveMode: house.stoveMode, jianxiangTolerance: house.jianxiangTolerance, replacementMode: house.replacementMode }) } catch { return null } }, [persons, house, activePlan, floors, plan])
  const chapters = useMemo<Chapter[]>(() => (report ? buildChapters(report, activePlan, MASTER) : []), [report, activePlan])
  const [idx, setIdx] = useState(0)
  const [toc, setToc] = useState(false)
  const [started, setStarted] = useState(false)
  const [textKey, setTextKey] = useState(0)
  const mountRef = useRef<HTMLDivElement>(null)
  const houseRef = useRef<House3D | null>(null)
  const hasPlan = activePlan.outline.length >= 3
  const [coverOk, setCoverOk] = useState(true)
  const coverSrc = `${import.meta.env.BASE_URL}cover.jpg`

  // build the 3D house once
  useEffect(() => {
    if (!hasPlan || !mountRef.current) return
    let disposed = false
    import('../story/house3d').then((m) => {
      if (disposed || !mountRef.current) return
      const h = m.createHouse3D(activePlan)
      h.mount(mountRef.current)
      houseRef.current = h
    })
    return () => { disposed = true; houseRef.current?.dispose(); houseRef.current = null }
  }, [activePlan, hasPlan])

  // drive camera + overlay per chapter
  useEffect(() => {
    const h = houseRef.current
    const ch = chapters[idx]
    if (!h || !ch || !report) return
    h.goTo(ch.cue)
    const palette: Record<string, string | undefined> = {}
    if (ch.cue.kind === 'top' && ch.cue.overlay === 'annual') {
      for (const p of report.xuankong.palaces) palette[p.palace] = [5, 2, 3, 7].includes(p.annualStar) ? '#c2410c' : [8, 9, 1, 6, 4].includes(p.annualStar) ? '#2e8f6e' : '#9ca3af'
    } else if (ch.cue.kind === 'top' && ch.cue.overlay === 'wealth') {
      for (const t of report.bazhai.wealth) palette[t] = '#2e8f6e'
      for (const t of report.bazhai.wenchang) if ((t as string) !== 'center') palette[t as Trigram] = '#2563eb'
      for (const t of report.bazhai.wealthLeak) palette[t] = '#9ca3af'
    }
    h.setOverlay(palette, ch.highlight ?? [])
    setTextKey((k) => k + 1)
  }, [idx, chapters, report, started])

  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') setIdx((i) => Math.min(chapters.length - 1, i + 1)); if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1)) }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [chapters.length])

  if (!report) return null
  const ch = chapters[idx]
  const annualLegend = ch?.cue.kind === 'top' && ch.cue.overlay === 'annual' ? report.xuankong.palaces.map((p) => `${p.palace}:${NINE_STARS[p.annualStar]!.zh}`) : null
  void annualLegend

  return (
    <div className="dark fixed inset-0 z-50 flex flex-col bg-[#0f1013] text-zinc-100">
      {/* 3D stage */}
      <div ref={mountRef} className="absolute inset-0" />
      {!hasPlan && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-zinc-300">
          <div>還沒有平面圖，師傅沒辦法看房。<div className="mt-3"><Link to="/plan/wizard"><Button variant="brand">用精靈建一張</Button></Link></div></div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/90 via-black/70 to-transparent" />

      {/* header */}
      <header className="relative z-10 flex h-12 items-center gap-2 px-2 safe-t">
        <button className="flex size-9 items-center justify-center rounded-full bg-white/10" onClick={() => nav('/report')} aria-label="離開"><X className="size-5" /></button>
        <div className="min-w-0 flex-1 truncate text-sm font-medium">{MASTER}看房{ch ? `：${ch.label}` : ''}</div>
        <button className="flex size-9 items-center justify-center rounded-full bg-white/10" onClick={() => setToc(true)} aria-label="目錄"><List className="size-5" /></button>
      </header>

      {/* cover: full-bleed illustration when available, else the rotating 3D house */}
      {!started && hasPlan && coverOk && (
        <img src={coverSrc} alt="" onError={() => setCoverOk(false)} className="absolute inset-0 h-full w-full object-cover object-top" />
      )}
      {!started && hasPlan && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-end p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] text-center">
          {!coverOk && <MasterAvatar size={128} className="mb-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)]" />}
          <h1 className="text-3xl font-semibold tracking-tight">{MASTER}看房</h1>
          <p className="mt-2 max-w-xs text-sm text-zinc-300">帶你從門口走一圈，每一間房說一段。看完會有一份照難易度排好的清單。</p>
          <Button variant="brand" size="lg" className="mt-6 w-full max-w-xs" onClick={() => { setStarted(true); setIdx(0) }}>開始看房</Button>
          <p className="mt-3 text-xs text-zinc-500">{chapters.length} 章，約三分鐘</p>
        </div>
      )}

      {/* chapter */}
      {started && ch && (
        <div className="relative z-10 mt-auto flex flex-col p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div key={textKey} className="mx-auto w-full max-w-md sheet-enter">
            <div className="flex items-end gap-3">
              <MasterAvatar size={64} />
              <div className="relative mb-2 rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg">{ch.bubble}</div>
            </div>
            <h2 className="mt-4 text-xl font-semibold">{ch.title}</h2>
            <div className="mt-2 max-h-[38vh] space-y-2 overflow-y-auto pr-1 text-[15px] leading-relaxed text-zinc-200">
              {ch.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
              {ch.todos.length > 0 && (
                <ul className="mt-2 space-y-1 rounded-xl bg-white/8 p-3 text-sm">
                  {ch.todos.map((t, i) => <li key={i} className="flex gap-2"><span className="text-brand">•</span><span>{t}</span></li>)}
                </ul>
              )}
            </div>
          </div>
          <div className="mx-auto mt-4 flex w-full max-w-md items-center gap-2">
            <button className="flex size-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-30" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} aria-label="上一頁"><ChevronLeft className="size-5" /></button>
            <div className="flex flex-1 items-center gap-1">{chapters.map((c, i) => <button key={c.id} onClick={() => setIdx(i)} aria-label={c.label} className={cn('h-1.5 flex-1 rounded-full', i <= idx ? 'bg-brand' : 'bg-white/20')} />)}</div>
            {idx < chapters.length - 1 ? (
              <button className="flex size-11 items-center justify-center rounded-full bg-white text-zinc-900" onClick={() => setIdx((i) => i + 1)} aria-label="下一頁"><ChevronRight className="size-5" /></button>
            ) : (
              <Button variant="brand" onClick={() => nav('/report')}>看完整清單</Button>
            )}
          </div>
        </div>
      )}

      {/* table of contents */}
      {toc && (
        <div className="absolute inset-0 z-20 bg-black/70" onClick={() => setToc(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-[#17181b] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sheet-enter" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-sm font-medium">目錄</div>
            <ol className="divide-y divide-white/10">
              {chapters.map((c, i) => (
                <li key={c.id}><button className={cn('flex w-full items-center gap-3 py-3 text-left text-sm', i === idx && 'text-brand')} onClick={() => { setIdx(i); setStarted(true); setToc(false) }}><span className="w-6 text-zinc-500">{i + 1}</span><span className="flex-1">{c.title}</span><span className="text-xs text-zinc-500">{c.label}</span></button></li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
