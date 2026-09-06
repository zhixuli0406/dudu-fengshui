import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import { DirectionPad } from '../components/DirectionPad'
import { resolveAnalysisPlan, useAppStore } from '../store/useAppStore'
import { PALACES, type Trigram } from '../engine/bagua'
import { analyzePerson, groupZh } from '../engine/bazhai'
import { fengshuiYearOf } from '../engine/calendar'
import { buildReport, type Report } from '../engine/report'
import { palaceLabel } from '../engine/annual'
import { FACING_QUESTION, keyItemOf, type LiteRoom } from '../engine/lite'
import { ROOM_ZH } from '../engine/floorplan'
import { NINE_STARS, RATING_ZH } from '../engine/stars'
import { periodOfYear } from '../engine/xuankong'
import { buildActions } from '../engine/advice'
import { BUILT_CHOICES, FACING_WHY, firstStep, nextStep, pendingRoomType, prevStep, progressOf, roomMenu, type GuideCtx, type StepId } from '../guide/script'
import { Escape, Scene, choiceCls } from '../guide/Scene'
import { DoorCompass } from '../guide/DoorCompass'
import { cn } from '../lib/utils'

const MASTER = '嘟嘟師傅'
const dirZh = (t: Trigram | 'center') => (t === 'center' ? '中宮' : PALACES[t].direction)

/**
 * 師傅來看房：one question per screen, asked in the master's voice, a short scene at the door,
 * a reveal after the basics and a verdict after each room. Pure flow logic lives in guide/script.ts.
 */
export function StartPage() {
  const nav = useNavigate()
  const { house, setHouse, persons, addPerson, removePerson, lite, addLiteRoom, updateLiteRoom, setLite, floors, plan } = useAppStore()
  const ctx = useMemo<GuideCtx>(() => ({ introSeen: !!lite.introSeen, hasFacing: house.facingSource !== 'none', persons: persons.length, rooms: lite.rooms, pendingType: lite.pendingType, pendingId: lite.pendingId }), [lite, house.facingSource, persons.length])
  const step: StepId = lite.stepId ?? firstStep(ctx)
  const resolved = useMemo(() => resolveAnalysisPlan(floors, plan, house, lite, 'lite'), [floors, plan, house, lite])
  const report = useMemo(() => { try { return buildReport(persons, { facingBearing: house.facingBearing, periodYear: house.periodYear, plan: resolved.plan, floors: resolved.floors, stoveMode: house.stoveMode, jianxiangTolerance: house.jianxiangTolerance, replacementMode: house.replacementMode }) } catch { return null } }, [persons, house, resolved])
  const [adding, setAdding] = useState(false)
  const goTo = (id: StepId) => { setLite({ stepId: id }); setAdding(false) }
  const back = () => {
    const p = prevStep(step, ctx)
    if (!p) { nav('/'); return }
    // stepping back into a room verdict with nothing pending: re-open the last room asked about
    const last = lite.rooms[lite.rooms.length - 1]
    if (p === 'roomVerdict' && !pendingRoom && last) { setLite({ pendingId: last.id, pendingType: last.type, stepId: p }); setAdding(false); return }
    goTo(p)
  }
  const later = (id: StepId) => window.setTimeout(() => goTo(id), 380)
  const { n, total } = progressOf(step)
  const askType = pendingRoomType(ctx)
  const pendingRoom = lite.rooms.find((r) => r.id === lite.pendingId)
  const owner = persons[0]
  const isScene = step === 'intro' || step === 'reveal' || step === 'roomVerdict' || step === 'summary'

  // guard: steps that need data the user has not given yet fall back to where it is asked
  useEffect(() => {
    if ((step === 'reveal' || step === 'roomWhere' || step === 'roomFacing' || step === 'roomVerdict' || step === 'roomType' || step === 'summary') && house.facingSource === 'none') goTo('door')
    else if ((step === 'roomFacing' || step === 'roomVerdict') && !pendingRoom) goTo('roomType')
    else if (step === 'roomWhere' && !askType) goTo('roomType')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, house.facingSource, pendingRoom, askType])

  let body: ReactNode = null

  if (step === 'intro') {
    const start = () => { setLite({ introSeen: true }); goTo('door') }
    body = <Scene key="intro" name={MASTER} lines={['到了。', '先別急著開門。房子要從門口看起，門是氣口，門看對了，屋裡的事才好談。']}
      choices={[{ label: '好，從門口開始', primary: true, onPick: start }, { label: '我只想知道財位在哪', reply: '財位也得先看門。來，站到門裡。', onPick: start }]} />
  }

  if (step === 'door') {
    body = (
      <Ask kicker="站在門裡" ask="大門朝哪個方向？" why="方向差一格，財位就換邊。">
        <DoorCompass current={house.facingSource !== 'none' ? house.facingBearing : null} onKeep={() => goTo('owner')}
          onConfirm={(bearing, source) => { setHouse({ facingBearing: bearing, facingSource: source }); later('owner') }} />
      </Ask>
    )
  }

  if (step === 'owner') {
    body = (
      <Ask kicker="進門前" ask="這個家，誰當家？" why="命卦跟著人走，床頭、書桌都看他。">
        {persons.length > 0 && <PersonRows persons={persons} report={report} onRemove={removePerson} />}
        {persons.length === 0 || adding ? <PersonForm label={persons.length ? '加入' : '就是這位'} onAdd={(p) => { addPerson(p); goTo('more') }} />
          : <div className="grid gap-2"><button className={choiceCls(true)} onClick={() => goTo('more')}>就是{owner?.name ?? '這位'}</button><button className={choiceCls()} onClick={() => setAdding(true)}>換一個人</button></div>}
      </Ask>
    )
  }

  if (step === 'more') {
    body = (
      <Ask kicker="順便問" ask="還有誰要一起看？" why="一家人命卦不同，我分開講。">
        <PersonRows persons={persons} report={report} onRemove={removePerson} />
        {adding ? <PersonForm label="加入" onAdd={(p) => { addPerson(p); setAdding(false) }} /> : (
          <div className="mt-2 grid gap-2">
            <button className={choiceCls()} onClick={() => setAdding(true)}>再加一位（例如另一半、小孩）</button>
            <button className={choiceCls(true)} onClick={() => goTo('built')}>{persons.length > 1 ? '就這些人' : `先看${owner?.name ?? '屋主'}就好`}</button>
          </div>
        )}
      </Ask>
    )
  }

  if (step === 'built') {
    body = (
      <Ask kicker="這房子" ask="大概哪一年蓋好的？" why="哪一運入住，飛星盤就不一樣。">
        <div className="grid grid-cols-2 gap-2">
          {BUILT_CHOICES.map((c) => <button key={c.year} className={choiceCls(false, 'flex flex-col py-2.5')} onClick={() => { setHouse({ periodYear: c.year }); later('reveal') }}><span>{c.label}</span><span className="text-xs text-zinc-400">{periodOfYear(c.year)} 運</span></button>)}
        </div>
        <Escape label="不知道，先用現在的運" onPick={() => { setHouse({ periodYear: new Date().getFullYear() }); goTo('reveal') }} />
      </Ask>
    )
  }

  if (step === 'reveal' && report) {
    const primary = report.persons.find((p) => p.person.primary) ?? report.persons[0]
    const lines = [
      `${PALACES[report.house.houseGua].zh}宅，坐${report.house.sitting.name}向${report.house.facing.name}，${report.period} 運。`,
      `財位在${report.bazhai.wealth.map((t) => PALACES[t].direction).join('、')}，文昌在${report.bazhai.wenchang.map(dirZh).join('、')}。洩財位在${report.bazhai.wealthLeak.map((t) => PALACES[t].direction).join('、')}，魚缸別放那。`,
    ]
    if (primary) {
      const best = primary.bestDirections[0]!
      lines.push(`${primary.person.name}是${PALACES[primary.gua].zh}命，${groupZh(primary.group)}命。${primary.compatible ? '跟這房子同一組，順。' : `跟房子不同組，不要緊，床頭朝${PALACES[best].direction}就補得回來。`}`)
    }
    const cells = Object.fromEntries([
      ...report.bazhai.wealthLeak.map((t) => [t, { label: '洩財', tone: 'muted' }]),
      ...report.bazhai.wenchang.filter((t) => (t as string) !== 'center').map((t) => [t, { label: '文昌', tone: 'info' }]),
      ...report.bazhai.wealth.map((t) => [t, { label: '財位', tone: 'good' }]),
    ]) as Partial<Record<Trigram, GridCell>>
    body = <Scene key="reveal" lines={lines} aside={<MiniGrid door={report.xuankong.chart.facingPalace} cells={cells} />}
      choices={[{ label: '進屋，看房間', primary: true, onPick: () => goTo(nextStep('reveal', ctx)) }, { label: '先這樣，看清單', onPick: () => nav('/report') }]} />
  }

  if (step === 'roomWhere' && askType) {
    const taken = lite.rooms.filter((r) => r.id !== pendingRoom?.id).map((r) => r.palace)
    body = (
      <Ask kicker={lite.rooms.length && !pendingRoom ? '下一間' : '進屋了'} ask={`${ROOM_ZH[askType]}在家的哪一邊？`} why="站在客廳中央，往那間房看的方向。">
        <DirectionPad value={pendingRoom?.palace ?? null} dim={taken} center={<span className="text-xs text-zinc-500">中</span>}
          onChange={(t) => {
            let id = pendingRoom?.id
            if (id) updateLiteRoom(id, { palace: t }); else id = addLiteRoom({ type: askType, palace: t })
            setLite({ pendingId: id, pendingType: askType })
            later(nextStep('roomWhere', { ...ctx, pendingType: askType, pendingId: id }))
          }} />
        <p className="mt-2 text-right text-[11px] text-zinc-500">上方為北。已有房間的格子會變淡。</p>
        <Escape label="這間先跳過" onPick={() => { setLite({ pendingType: undefined, pendingId: undefined }); goTo(lite.rooms.length ? 'roomType' : 'summary') }} />
      </Ask>
    )
  }

  if (step === 'roomFacing' && pendingRoom) {
    body = (
      <Ask kicker={`站在${ROOM_ZH[pendingRoom.type]}裡`} ask={FACING_QUESTION[pendingRoom.type] ?? '朝哪個方向？'} why={FACING_WHY[pendingRoom.type]}>
        <DirectionPad value={pendingRoom.facing ?? null} center={<span className="text-xs text-zinc-500">朝向</span>} onChange={(t) => { updateLiteRoom(pendingRoom.id, { facing: t }); later('roomVerdict') }} />
        <p className="mt-2 text-right text-[11px] text-zinc-500">上方為北</p>
        <Escape label="不確定，先略過" onPick={() => goTo('roomVerdict')} />
      </Ask>
    )
  }

  if (step === 'roomVerdict' && pendingRoom && report) {
    body = <Scene key={`verdict_${pendingRoom.id}`} lines={roomLines(report, pendingRoom)}
      choices={[{ label: '再看下一間', primary: true, onPick: () => { setLite({ pendingType: undefined, pendingId: undefined }); goTo('roomType') } }, { label: '夠了，聽結論', onPick: () => { setLite({ pendingType: undefined, pendingId: undefined }); goTo('summary') } }]} />
  }

  if (step === 'roomType') {
    body = (
      <Ask kicker="還有嗎" ask="還有哪一間要看？" why="加幾間看幾間，不用一次講完。">
        <div className="grid grid-cols-2 gap-2">
          {roomMenu(lite.rooms).map((t) => <button key={t} className={choiceCls()} onClick={() => { setLite({ pendingType: t, pendingId: undefined }); goTo('roomWhere') }}>{ROOM_ZH[t]}</button>)}
        </div>
        <button className={choiceCls(true, 'mt-3')} onClick={() => { setLite({ pendingType: undefined, pendingId: undefined }); goTo('summary') }}>夠了，聽結論</button>
        {lite.rooms.length > 0 && <p className="mt-3 text-xs text-zinc-500">看過：{lite.rooms.map((r) => `${ROOM_ZH[r.type]}（${PALACES[r.palace].direction}）`).join('、')}</p>}
      </Ask>
    )
  }

  if (step === 'summary' && report) {
    body = <Scene key="summary" lines={summaryLines(report)}
      choices={[{ label: '看怎麼做（清單）', primary: true, onPick: () => nav('/report') }, { label: '讓師傅 3D 帶我走一遍', onPick: () => nav('/story') }, { label: '畫平面圖，看門沖、樑壓', onPick: () => nav('/plan/wizard') }]} />
  }

  return (
    <div className="dark fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0c0d10] text-zinc-100">
      {step === 'intro' && <img src={`${import.meta.env.BASE_URL}cover.jpg`} alt="" className="guide-fade absolute inset-0 h-full w-full object-cover object-[50%_30%] opacity-80 [mask-image:linear-gradient(to_bottom,black_35%,transparent_85%)]" />}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-[radial-gradient(70%_55%_at_50%_100%,rgba(214,179,92,0.14),transparent_70%)]" />
      <header className="relative z-10 flex h-12 shrink-0 items-center gap-3 px-3 safe-t">
        <button className="flex size-9 items-center justify-center rounded-full bg-white/10" onClick={back} aria-label={prevStep(step, ctx) ? '上一題' : '離開'}>{prevStep(step, ctx) ? <ArrowLeft className="size-5" /> : <X className="size-5" />}</button>
        <div className="h-px flex-1 overflow-hidden bg-white/10"><div className="h-full bg-brand transition-[width] duration-500" style={{ width: `${(n / total) * 100}%` }} /></div>
        {step === 'intro' ? <button className="text-xs text-zinc-400" onClick={() => { setLite({ introSeen: true }); goTo('door') }}>跳過</button> : <span className="w-10 text-right text-xs tabular-nums text-zinc-400">{n} / {total}</span>}
      </header>
      <main className="relative z-10 flex flex-1 flex-col justify-end overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div key={step} className={cn('mx-auto w-full max-w-md guide-enter', isScene && 'pb-2')}>{body}</div>
      </main>
    </div>
  )
}

/* ─── copy ───────────────────────────────────────────────────────────────── */

function roomLines(report: Report, room: LiteRoom): string[] {
  const pe = report.xuankong.palaces.find((p) => p.palace === room.palace)
  const lines: string[] = []
  if (pe) {
    lines.push(`${ROOM_ZH[room.type]}在${PALACES[room.palace].direction}方，${PALACES[room.palace].zh}宮。這一宮飛星${pe.mountainStar}${pe.waterStar}，${RATING_ZH[pe.combo.rating]}。`)
    const star = NINE_STARS[pe.annualStar]!.zh
    lines.push([5, 2].includes(pe.annualStar) ? `今年${star}到這裡，少動土、保持安靜整潔。` : [8, 9].includes(pe.annualStar) ? `今年${star}到這裡，多用、多亮燈，是好事。` : `今年流年${star}在這裡，平平。`)
  }
  const item = report.bazhai.items.find((it) => it.itemId === `lite_${room.id}_${keyItemOf(room.type) ?? ''}`)
  if (item && room.facing) {
    const what = item.label.replace(/（.+）/, '').replace(/朝向$/, '')
    for (const pp of item.perPerson) lines.push(`${what}朝${PALACES[room.facing].direction}，對${pp.name}是${pp.note}，${pp.verdict === 'good' ? '很好，不用動。' : '建議改朝吉方。'}`)
  }
  return lines.length ? lines : ['這間我看過了。']
}

function summaryLines(report: Report): string[] {
  const actions = buildActions(report)
  const top = actions.filter((a) => a.priority === 1).slice(0, 3)
  const a = report.annual.data
  return [
    '走完一圈了。',
    `整體我給 ${report.scores.overall} 分。${report.scores.overall >= 75 ? '底子不錯。' : report.scores.overall >= 50 ? '有幾處值得動手。' : '有幾個明顯的問題，都有解法。'}`,
    top.length ? `最要緊的：${top.map((t) => t.title).join('；')}。` : '沒有需要優先處理的大問題。',
    `${report.year} 年五黃在${palaceLabel(a.wuhuang)}、二黑在${palaceLabel(a.erhei)}，這兩處別動土、別釘釘子。`,
  ]
}

/* ─── pieces ─────────────────────────────────────────────────────────────── */

function Ask({ kicker, ask, why, children }: { kicker?: string; ask: string; why?: string; children: ReactNode }) {
  return (
    <div>
      {kicker && <div className="mb-2 text-xs tracking-[0.3em] text-brand">{kicker}</div>}
      <h2 className="font-display text-[26px] leading-snug text-[#efe7d6]">{ask}</h2>
      {why && <p className="mt-1.5 text-[13px] text-amber-200/70">{why}</p>}
      <div className="mt-5">{children}</div>
    </div>
  )
}

const fieldCls = 'h-12 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-brand focus:outline-none'

function PersonForm({ onAdd, label }: { onAdd: (p: { name: string; birthDate: string; gender: 'male' | 'female' }) => void; label: string }) {
  const [name, setName] = useState('')
  const [birth, setBirth] = useState('1990-01-01')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  return (
    <div className="grid grid-cols-2 gap-2">
      <input className={cn(fieldCls, 'col-span-2')} placeholder="怎麼稱呼（例：我、老公、媽媽）" value={name} onChange={(e) => setName(e.target.value)} />
      {(['male', 'female'] as const).map((g) => <button key={g} type="button" className={choiceCls(gender === g)} onClick={() => setGender(g)}>{g === 'male' ? '男' : '女'}</button>)}
      <label className="col-span-2 text-xs text-zinc-400">出生日期（國曆）<input type="date" className={cn(fieldCls, 'mt-1')} value={birth} onChange={(e) => setBirth(e.target.value)} /></label>
      <button type="button" className={choiceCls(true, 'col-span-2')} disabled={!birth} onClick={() => { onAdd({ name: name.trim() || '屋主', birthDate: birth, gender }); setName('') }}>{label}</button>
    </div>
  )
}

function PersonRows({ persons, report, onRemove }: { persons: { id: string; name: string; birthDate: string; gender: 'male' | 'female' }[]; report: Report | null; onRemove: (id: string) => void }) {
  return (
    <ul className="mb-3 divide-y divide-white/10 rounded-xl border border-white/10">
      {persons.map((p) => {
        const by = fengshuiYearOf(new Date(p.birthDate + 'T12:00:00')).year
        const r = analyzePerson(by, p.gender)
        const compat = report && report.house ? r.group === report.house.group : null
        return (
          <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
            <span className="flex-1"><span className="font-medium">{p.name}</span><span className="ml-2 text-zinc-400">{by} 年生・{PALACES[r.gua].zh}命</span>{compat != null && <span className={cn('ml-2 text-xs', compat ? 'text-brand' : 'text-amber-200/80')}>{compat ? '同組' : '不同組'}</span>}</span>
            <button className="text-zinc-500" onClick={() => onRemove(p.id)} aria-label="移除"><X className="size-4" /></button>
          </li>
        )
      })}
    </ul>
  )
}

type GridCell = { label: string; tone: 'good' | 'info' | 'bad' | 'muted' | 'plain' }

/** Nine-palace grid (north up) with a label per cell; kept small so it reads as a note, not a dashboard. */
function MiniGrid({ cells, door }: { cells: Partial<Record<Trigram, GridCell>>; door?: Trigram }) {
  const grid: (Trigram | 'center')[][] = [['qian', 'kan', 'gen'], ['dui', 'center', 'zhen'], ['kun', 'li', 'xun']]
  const tone = { good: 'bg-brand/25 text-brand', info: 'bg-sky-500/25 text-sky-200', bad: 'bg-rose-500/25 text-rose-200', muted: 'bg-white/10 text-zinc-300', plain: 'bg-white/5 text-zinc-400' }
  return (
    <div className="max-w-[240px]">
      <div className="grid grid-cols-3 gap-1">
        {grid.flat().map((t) => {
          const c = t === 'center' ? undefined : cells[t]
          return (
            <div key={t} className={cn('flex h-12 flex-col items-center justify-center rounded-md text-xs', c ? tone[c.tone] : 'bg-white/5 text-zinc-500', t === door && 'ring-1 ring-white/70')}>
              <span className="font-medium">{t === 'center' ? '中' : PALACES[t].direction}</span>
              {c && <span className="text-[10px]">{c.label}</span>}
              {t === door && <span className="text-[9px] text-zinc-200">大門</span>}
            </div>
          )
        })}
      </div>
      <p className="mt-1 text-[10px] text-zinc-500">上方為北</p>
    </div>
  )
}
