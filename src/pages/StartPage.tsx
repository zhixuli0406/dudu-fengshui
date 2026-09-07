import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import { resolveAnalysisPlan, useAppStore } from '../store/useAppStore'
import { PALACES, type Trigram } from '../engine/bagua'
import { analyzePerson, groupZh } from '../engine/bazhai'
import { fengshuiYearOf } from '../engine/calendar'
import { buildReport, type Report } from '../engine/report'
import { palaceLabel } from '../engine/annual'
import { emptyPlan, newId, ROOM_ZH, type FloorPlan } from '../engine/floorplan'
import { periodOfYear } from '../engine/xuankong'
import { buildActions } from '../engine/advice'
import { keyItemFor } from '../engine/wizard'
import { deriveWizardPlan, ITEM_WHY } from '../engine/wizardPlan'
import { DOOR_STAND, floorName, HOME_TYPES, homeTypeInfo, type HomeType } from '../engine/homeTypes'
import { buildChapters } from '../story/chapters'
import { detectAR, openInLaunchViewer, type ARCapability } from '../ar/providers'
import { BUILT_CHOICES, firstStep, floorSource, isStepId, nextStep, prevStep, progressOf, roomStops, type GuideCtx, type Move, type StepId } from '../guide/script'
import { Escape, Scene, choiceCls } from '../guide/Scene'
import { DoorCompass } from '../guide/DoorCompass'
import { PaintStep, RoomTapStep, SizeStep } from '../guide/PlanSteps'
import { WalkStep, arUsable } from '../guide/WalkStep'
import { PalaceRose, type RoseTone } from '../guide/PalaceRose'
import { cn } from '../lib/utils'

const MASTER = '嘟嘟師傅'
const dirZh = (t: Trigram | 'center') => (t === 'center' ? '中宮' : PALACES[t].direction)
const FLOOR_CHOICES = [2, 3, 4, 5]

/**
 * 師傅來看房：one question per screen, asked in the master's voice. Home type → door by compass → people →
 * period → reveal → each floor is walked with the camera (AR) or sketched from the doorway → every room
 * gets its verdict → summary. Pure flow logic lives in guide/script.ts.
 */
export function StartPage() {
  const nav = useNavigate()
  const { house, setHouse, persons, addPerson, removePerson, lite, setLite, floors, plan, wizard, setWizard, setFloors } = useAppStore()
  const [cap, setCap] = useState<ARCapability | null>(null)
  useEffect(() => { detectAR().then(setCap) }, [])
  const arAvailable = arUsable(cap)

  const homeType: HomeType = house.homeType ?? 'unit'
  const floorCount = house.floorCount ?? (house.homeType ? (homeTypeInfo(homeType).floors === 'ask' ? 3 : (homeTypeInfo(homeType).floors as number)) : 1)
  const floorIdx = Math.min(lite.floorIdx ?? 0, Math.max(0, floorCount - 1))
  const floorPlan: FloorPlan | undefined = floors[floorIdx]
  const ctx = useMemo<GuideCtx>(() => ({
    introSeen: !!lite.introSeen, hasFacing: house.facingSource !== 'none', persons: persons.length, arAvailable, floorCount, floorIdx,
    floorRooms: Array.from({ length: floorCount }, (_, i) => (floors[i] && !floors[i]!.synthetic ? roomStops(floors[i]!) : [])),
    floorSources: Array.from({ length: floorCount }, (_, i) => floorSource(floors[i]?.synthetic ? undefined : floors[i])),
    pendingId: lite.pendingId,
  }), [lite.introSeen, lite.pendingId, house.facingSource, persons.length, arAvailable, floorCount, floorIdx, floors])
  const step: StepId = isStepId(lite.stepId) ? lite.stepId : firstStep(ctx)
  const resolved = useMemo(() => resolveAnalysisPlan(floors, plan, house, lite), [floors, plan, house, lite])
  const report = useMemo(() => { try { return buildReport(persons, { facingBearing: house.facingBearing, periodYear: house.periodYear, plan: resolved.plan, floors: resolved.floors, stoveMode: house.stoveMode, jianxiangTolerance: house.jianxiangTolerance, replacementMode: house.replacementMode }) } catch { return null } }, [persons, house, resolved])
  const chapters = useMemo(() => (report && floorPlan ? buildChapters(report, floorPlan, MASTER) : []), [report, floorPlan])
  const upper = floorIdx > 0
  const fName = floorName(homeType, floorIdx)
  const derived = useMemo(() => deriveWizardPlan(wizard, house.facingBearing, { upper, northOffset: floors[0]?.northOffset, name: fName, level: floorIdx }), [wizard, house.facingBearing, upper, floors, fName, floorIdx])
  const [adding, setAdding] = useState(false)
  const move = (m: Move) => { setLite({ stepId: m.id, pendingId: m.pendingId, floorIdx: m.floorIdx ?? lite.floorIdx ?? 0 }); setAdding(false) }
  const goTo = (id: StepId) => move({ id })
  const later = (m: Move) => window.setTimeout(() => move(m), 380)
  const back = () => { const p = prevStep(step, ctx); if (p) move(p); else nav('/report') }
  const { n, total } = progressOf(step)
  const pendingRoom = floorPlan?.rooms.find((r) => r.id === lite.pendingId)
  const owner = persons[0]
  const isScene = step === 'intro' || step === 'reveal' || step === 'roomVerdict' || step === 'upstairs' || step === 'summary'
  const afterDoor = !['intro', 'home', 'door'].includes(step)
  const roomStep = step === 'furniture' || step === 'roomVerdict'

  /** Replace one floor's plan, padding the list so `floors[idx]` exists. */
  const saveFloor = (idx: number, p: FloorPlan) => {
    const next = [...floors]
    while (next.length <= idx) next.push(emptyPlan(floorName(homeType, next.length), next.length))
    next[idx] = { ...p, name: floorName(homeType, idx), level: idx }
    setFloors(next)
    return next
  }
  /** Context as it will be once `floors` is replaced (store updates land after this render). */
  const ctxWith = (nextFloors: FloorPlan[], patch: Partial<GuideCtx> = {}): GuideCtx => ({ ...ctx, floorRooms: nextFloors.map((f) => roomStops(f)), floorSources: nextFloors.map((f) => floorSource(f)), ...patch })

  // guards: a step that needs data the user has not given yet falls back to where it is asked
  useEffect(() => {
    if (afterDoor && house.facingSource === 'none') goTo('door')
    else if (roomStep && !pendingRoom) move(ctx.floorSources[floorIdx] === 'none' ? { id: arAvailable ? 'build' : 'size', floorIdx } : { id: 'summary' })
    else if ((step === 'build' || step === 'walk') && cap && !arAvailable) move({ id: 'size', floorIdx })
    else if (step === 'size' && wizard.doorWall !== 'bottom') setWizard({ doorWall: 'bottom' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, house.facingSource, pendingRoom, wizard.doorWall, cap, arAvailable])

  let body: ReactNode = null

  if (step === 'intro') {
    const start = () => { setLite({ introSeen: true }); goTo('home') }
    body = <Scene key="intro" name={MASTER} lines={['到了。', '先別急著開門。房子要從門口看起，門是氣口，門看對了，屋裡的事才好談。']}
      choices={[{ label: '好，從門口開始', primary: true, onPick: start }, { label: '我只想知道財位在哪', reply: '財位也得先看門。來，先告訴我這是什麼樣的房子。', onPick: start }]} />
  }

  if (step === 'home') {
    const info = house.homeType ? homeTypeInfo(house.homeType) : null
    body = (
      <Ask kicker="門口" ask="這是什麼樣的房子？" why="幾層樓一起看，樓上樓下才對得起來。">
        <div className="grid gap-2">
          {HOME_TYPES.map((h) => (
            <button key={h.id} className={choiceCls(house.homeType === h.id, 'flex flex-col items-start py-2.5 text-left')} onClick={() => { const fc = h.floors === 'ask' ? (house.floorCount && house.floorCount > 1 ? house.floorCount : 3) : h.floors; setHouse({ homeType: h.id, floorCount: fc }); if (h.floors !== 'ask') later({ id: 'door' }) }}>
              <span>{h.label}<span className="ml-2 text-xs opacity-70">{h.hint}</span></span>
              <span className="text-xs opacity-60">{h.examples}</span>
            </button>
          ))}
        </div>
        {info?.floors === 'ask' && (
          <div className="mt-3">
            <div className="mb-1.5 text-xs text-zinc-400">住的部分有幾層？（含一樓）</div>
            <div className="grid grid-cols-4 gap-2">{FLOOR_CHOICES.map((c) => <button key={c} className={choiceCls(house.floorCount === c)} onClick={() => setHouse({ floorCount: c })}>{c} 層</button>)}</div>
            <button className={choiceCls(true, 'mt-3')} onClick={() => goTo('door')}>就這樣</button>
          </div>
        )}
      </Ask>
    )
  }

  if (step === 'door') {
    body = (
      <Ask kicker="站在門裡" ask="大門朝哪個方向？" why={`${DOOR_STAND[homeType]}方向差一格，財位就換邊。`}>
        <DoorCompass current={house.facingSource !== 'none' ? house.facingBearing : null} onKeep={() => goTo('owner')}
          onConfirm={(bearing, source) => { setHouse({ facingBearing: bearing, facingSource: source }); later({ id: 'owner' }) }} />
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
          {BUILT_CHOICES.map((c) => <button key={c.year} className={choiceCls(false, 'flex flex-col py-2.5')} onClick={() => { setHouse({ periodYear: c.year }); later({ id: 'reveal' }) }}><span>{c.label}</span><span className="text-xs text-zinc-400">{periodOfYear(c.year)} 運</span></button>)}
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
    lines.push(arAvailable ? '接下來我要看屋裡。拿著手機跟我走一圈，門窗家具的位置和朝向我自己算。' : '接下來我要看屋裡。你站在門口，跟我描一下房子的樣子，一分鐘就好。')
    const cells = Object.fromEntries([
      ...report.bazhai.wealthLeak.map((t) => [t, { label: '洩財', tone: 'muted' }]),
      ...report.bazhai.wenchang.filter((t) => (t as string) !== 'center').map((t) => [t, { label: '文昌', tone: 'info' }]),
      ...report.bazhai.wealth.map((t) => [t, { label: '財位', tone: 'good' }]),
    ]) as Partial<Record<Trigram, { label: string; tone: RoseTone }>>
    body = <Scene key="reveal" lines={lines} aside={<PalaceRose door={report.xuankong.chart.facingPalace} cells={cells} />}
      choices={[{ label: '好，進屋', primary: true, onPick: () => move(nextStep('reveal', ctx)) }, { label: '先這樣，看清單', onPick: () => nav('/report') }]} />
  }

  if (step === 'build') {
    const needsLaunch = !!cap && !cap.nativeXR && cap.ios && cap.providerConfigured
    body = (
      <Ask kicker={upper ? `到${fName}了` : '進屋了'} ask={`${upper ? `${fName}` : '屋裡'}怎麼給我看？`} why="用鏡頭走一圈最準：門窗、家具的位置和朝向，我自己會算。">
        <div className="grid gap-2">
          <button className={choiceCls(true)} onClick={() => { if (needsLaunch && cap) { openInLaunchViewer(cap); return } move({ id: 'walk', floorIdx }) }}>{needsLaunch ? '在 iPhone 開啟鏡頭，跟我走一圈' : '拿鏡頭跟我走一圈'}</button>
          <button className={choiceCls()} onClick={() => move({ id: 'size', floorIdx })}>用畫的，站在門口描一下</button>
        </div>
        {needsLaunch && <p className="mt-2 text-xs text-zinc-500">iPhone 會先開啟一個小程式（App Clip）來用鏡頭，之後回到這裡繼續。</p>}
      </Ask>
    )
  }

  if (step === 'walk') {
    body = (
      <Ask kicker={upper ? `到${fName}了` : '進屋了'} ask="拿著手機，跟我走一圈。" why="外牆、房間、門窗、家具，一次點完。">
        <WalkStep upper={upper} floorName={fName} onSketch={() => move({ id: 'size', floorIdx })}
          onDone={(captured) => {
            // north: floor 0 trusts the door reading taken earlier; upper floors keep the AR compass or inherit
            let p = captured
            const md = p.items.find((i) => i.type === 'mainDoor')
            if (!upper && md) p = { ...p, northOffset: (((house.facingBearing - (md.facing + 180)) % 360) + 360) % 360 }
            else if (upper && floors[0]) p = { ...p, northOffset: p.northOffset || floors[0].northOffset }
            const next = saveFloor(floorIdx, p)
            move(nextStep('walk', ctxWith(next)))
          }} />
      </Ask>
    )
  }

  if (step === 'size') {
    const existing = floorPlan && !floorPlan.synthetic && floorPlan.rooms.length > 0 && ctx.floorSources[floorIdx] !== 'sketch'
    body = (
      <Ask kicker={upper ? `到${fName}了，站在樓梯口` : '進屋了'} ask={`${upper ? fName : '房子'}大概多大？`} why={upper ? '跟一樓同一個方向畫：樓梯口那面在下，左右多寬、往裡多深。' : '站在大門往裡看：左右多寬、往裡多深。'}>
        <SizeStep wizard={wizard} setWizard={setWizard} derived={derived} upper={upper} onNext={() => move({ id: 'paint', floorIdx })} onUseExisting={existing ? () => move(nextStep('paint', ctx)) : undefined} />
      </Ask>
    )
  }

  if (step === 'paint') {
    body = (
      <Ask kicker="畫房間" ask="房間各在哪裡？" why="先點一種房間，再點格子。不用塗滿，塗錯再點一次就清掉。">
        <PaintStep wizard={wizard} setWizard={setWizard} derived={derived}
          onDone={() => { const next = saveFloor(floorIdx, derived.plan); move(nextStep('paint', ctxWith(next))) }}
          onSkip={() => { const next = saveFloor(floorIdx, derived.plan); move(nextStep('roomVerdict', ctxWith(next, { pendingId: undefined }))) }} />
      </Ask>
    )
  }

  if (step === 'furniture' && pendingRoom && floorPlan) {
    const key = keyItemFor(pendingRoom.type)
    if (key) {
      body = (
        <Ask kicker={`站在${fName}的${ROOM_ZH[pendingRoom.type]}裡`} ask={key.question} why={ITEM_WHY[key.item]}>
          <RoomTapStep room={pendingRoom} plan={floorPlan} itemType={key.item} onSkip={() => move(nextStep('furniture', ctx))}
            onPlace={(item) => {
              const placed = { ...item, id: newId('i') }
              const others = floorPlan.items.filter((i) => !(i.roomId === pendingRoom.id && i.type === key.item))
              const next = saveFloor(floorIdx, { ...floorPlan, items: [...others, placed] })
              later(nextStep('furniture', ctxWith(next)))
            }} />
        </Ask>
      )
    }
  }

  if (step === 'roomVerdict' && pendingRoom && report) {
    const ch = chapters.find((c) => c.roomId === pendingRoom.id)
    const next = nextStep('roomVerdict', ctx)
    body = <Scene key={`verdict_${floorIdx}_${pendingRoom.id}`} lines={ch?.paragraphs.length ? ch.paragraphs : ['這間我看過了，沒什麼要說的。']}
      aside={ch?.todos.length ? <ul className="space-y-1 rounded-xl bg-white/8 p-3 text-sm text-zinc-200">{ch.todos.map((t, i) => <li key={i} className="flex gap-2"><span className="text-brand">•</span><span>{t}</span></li>)}</ul> : undefined}
      choices={next.id === 'summary' ? [{ label: '聽結論', primary: true, onPick: () => move(next) }] : next.id === 'upstairs' ? [{ label: '這層看完了', primary: true, onPick: () => move(next) }] : [{ label: '下一間', primary: true, onPick: () => move(next) }, { label: '夠了，聽結論', onPick: () => goTo('summary') }]} />
  }

  if (step === 'upstairs') {
    const nextName = floorName(homeType, floorIdx + 1)
    body = <Scene key={`up_${floorIdx}`} lines={[`${fName}看完了。`, `上樓。${nextName}也照樣走一遍，樓梯口記得標出來，樓上樓下我才對得起來。`]}
      choices={[{ label: `上${nextName}`, primary: true, onPick: () => { setWizard({ paint: {}, walls: {} }); move(nextStep('upstairs', ctx)) } }, { label: '樓上不看了，聽結論', onPick: () => goTo('summary') }]} />
  }

  if (step === 'summary' && report) {
    body = <Scene key="summary" lines={summaryLines(report)}
      choices={[{ label: '看怎麼做（清單）', primary: true, onPick: () => nav('/report') }, { label: '讓師傅 3D 帶我走一遍', onPick: () => nav('/story') }, { label: '微調平面圖，補門窗', onPick: () => nav('/plan') }]} />
  }

  return (
    <div className="dark fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0c0d10] text-zinc-100">
      {step === 'intro' && <img src={`${import.meta.env.BASE_URL}cover.jpg`} alt="" className="guide-fade absolute inset-0 h-full w-full object-cover object-[50%_30%] opacity-80 [mask-image:linear-gradient(to_bottom,black_35%,transparent_85%)]" />}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-[radial-gradient(70%_55%_at_50%_100%,rgba(214,179,92,0.14),transparent_70%)]" />
      <header className="relative z-10 flex h-12 shrink-0 items-center gap-3 px-3 safe-t">
        <button className="flex size-9 items-center justify-center rounded-full bg-white/10" onClick={back} aria-label={prevStep(step, ctx) ? '上一題' : '離開'}>{prevStep(step, ctx) ? <ArrowLeft className="size-5" /> : <X className="size-5" />}</button>
        <div className="h-px flex-1 overflow-hidden bg-white/10"><div className="h-full bg-brand transition-[width] duration-500" style={{ width: `${(n / total) * 100}%` }} /></div>
        {step === 'intro' ? <button className="text-xs text-zinc-400" onClick={() => { setLite({ introSeen: true }); goTo('home') }}>跳過</button> : <span className="w-10 text-right text-xs tabular-nums text-zinc-400">{n} / {total}</span>}
      </header>
      <main className="relative z-10 flex flex-1 flex-col justify-end overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div key={`${step}_${floorIdx}_${lite.pendingId ?? ''}`} className={cn('mx-auto w-full max-w-md guide-enter', isScene && 'pb-2')}>{body}</div>
      </main>
    </div>
  )
}

/* ─── copy ───────────────────────────────────────────────────────────────── */

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
      <div className="mt-4">{children}</div>
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
