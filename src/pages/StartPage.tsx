import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Compass, Plus, Trash2, X } from 'lucide-react'
import { MasterAvatar } from '../components/MasterAvatar'
import { DirectionPad } from '../components/DirectionPad'
import { Button, Input, NativeSelect } from '../components/mds'
import { resolveAnalysisPlan, useAppStore } from '../store/useAppStore'
import { PALACES, type Trigram } from '../engine/bagua'
import { analyzePerson, groupZh, WANDERING_STARS } from '../engine/bazhai'
import { fengshuiYearOf } from '../engine/calendar'
import { buildReport } from '../engine/report'
import { palaceLabel } from '../engine/annual'
import { FACING_QUESTION, keyItemOf } from '../engine/lite'
import { ROOM_ZH, type RoomType } from '../engine/floorplan'
import { NINE_STARS, RATING_ZH } from '../engine/stars'
import { periodOfYear } from '../engine/xuankong'
import { cn } from '../lib/utils'

const MASTER = '嘟嘟師傅'
const ROOM_CHOICES: RoomType[] = ['master', 'bedroom', 'kids', 'kitchen', 'study', 'bathroom', 'living', 'altar']
const STEPS = ['大門', '屋主', '今年', '房間', '更準'] as const

/** 新手村：一次一個問題，答完馬上有回饋。 */
export function StartPage() {
  const nav = useNavigate()
  const { house, setHouse, persons, addPerson, removePerson, lite, addLiteRoom, updateLiteRoom, removeLiteRoom, setLiteStep, floors, plan } = useAppStore()
  const step = lite.step
  const go = (n: number) => { setLiteStep(Math.max(0, Math.min(STEPS.length - 1, n))); window.scrollTo({ top: 0 }) }
  const resolved = useMemo(() => resolveAnalysisPlan(floors, plan, house, lite, 'lite'), [floors, plan, house, lite])
  const hasRealPlan = floors.some((f) => f.outline.length >= 3 && !f.synthetic)
  const report = useMemo(() => { try { return buildReport(persons, { facingBearing: house.facingBearing, periodYear: house.periodYear, plan: resolved.plan, floors: resolved.floors, stoveMode: house.stoveMode, jianxiangTolerance: house.jianxiangTolerance, replacementMode: house.replacementMode }) } catch { return null } }, [persons, house, resolved])
  const primary = report?.persons.find((p) => p.person.primary) ?? report?.persons[0]
  const facingPalace = house.facingSource !== 'none' ? (report?.xuankong.chart.facingPalace ?? null) : null

  const bubble = [
    house.facingSource === 'none' ? `我是${MASTER}。站在你家大門裡面往外看，是哪個方向？` : '好，方向有了。往下看結果。',
    persons.length ? '屋主的命卦我算好了。' : '屋主是誰？出生年給我就好。',
    '今年的流年，先講重點。',
    lite.rooms.length ? '再加一間，或者往下走。' : '主臥在家的哪一邊？告訴我方位就好，不用畫。',
    '想更準的話，有三條路。',
  ][step]

  return (
    <div className="dark fixed inset-0 z-50 flex flex-col bg-[#0f1013] text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(46,143,110,0.22),transparent_60%)]" />
      <header className="relative z-10 flex h-12 shrink-0 items-center gap-3 px-3 safe-t">
        <button className="flex size-9 items-center justify-center rounded-full bg-white/10" onClick={() => nav('/')} aria-label="離開"><X className="size-5" /></button>
        <ol className="flex flex-1 items-center gap-1">{STEPS.map((s, i) => <li key={s} className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-brand' : 'bg-white/15')} aria-label={s} />)}</ol>
        <span className="text-xs text-zinc-400">{step + 1}/{STEPS.length} {STEPS[step]}</span>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-md px-4 pb-6">
          <div className="mt-1 flex items-end gap-3">
            <MasterAvatar size={64} />
            <div className="mb-2 rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg">{bubble}</div>
          </div>

          {step === 0 && (
            <section className="mt-5 space-y-4">
              <h2 className="text-xl font-semibold">大門朝哪個方向？</h2>
              <DirectionPad value={facingPalace} onChange={(t) => setHouse({ facingBearing: PALACES[t].bearing, facingSource: 'manual' })}
                center={<Link to="/compass?return=/start" className="flex size-14 flex-col items-center justify-center rounded-full border border-brand/60 bg-brand/15 text-brand"><Compass className="size-5" /><span className="text-[10px]">羅盤</span></Link>} />
              <p className="text-xs text-zinc-500">上方為北。點中間的羅盤可用手機實測，最準。</p>
              {house.facingSource !== 'none' && report && (
                <ResultCard title={`${PALACES[report.house.houseGua].zh}宅`} sub={`${groupZh(report.house.group)}宅，向${report.house.facing.name}山 ${Math.round(house.facingBearing)}°，坐${report.house.sitting.name}`}>
                  <div className="flex flex-wrap gap-1.5">
                    <Tag tone="good">財位 {report.bazhai.wealth.map((t) => PALACES[t].direction).join('、')}</Tag>
                    <Tag tone="info">文昌 {report.bazhai.wenchang.map((t) => (t as string) === 'center' ? '中宮' : PALACES[t as Trigram].direction).join('、')}</Tag>
                    <Tag tone="muted">洩財 {report.bazhai.wealthLeak.map((t) => PALACES[t].direction).join('、')}</Tag>
                  </div>
                  <MiniGrid door={report.xuankong.chart.facingPalace} cells={Object.fromEntries([
                    ...report.bazhai.wealthLeak.map((t) => [t, { label: '洩財', tone: 'muted' }]),
                    ...report.bazhai.wenchang.filter((t) => (t as string) !== 'center').map((t) => [t, { label: '文昌', tone: 'info' }]),
                    ...report.bazhai.wealth.map((t) => [t, { label: '財位', tone: 'good' }]),
                  ])} />
                  <p className="text-xs text-zinc-400">財位放聚寶盆或綠植，文昌位放書桌，洩財位別放魚缸。{report.period} 運玄空盤「{report.xuankong.patternZh}」。</p>
                  <label className="flex items-center justify-between gap-3 rounded-lg bg-black/25 px-3 py-2 text-sm">
                    <span>房子大約哪一年蓋的？<span className="block text-xs text-zinc-500">不知道就用現在的年份</span></span>
                    <Input type="number" className="w-24 border-white/15 bg-black/20 text-right text-zinc-100" value={house.periodYear} onChange={(e) => setHouse({ periodYear: Number(e.target.value) || house.periodYear })} />
                  </label>
                  <p className="text-xs text-zinc-500">{periodOfYear(house.periodYear)} 運</p>
                </ResultCard>
              )}
            </section>
          )}

          {step === 1 && (
            <section className="mt-5 space-y-4">
              <h2 className="text-xl font-semibold">屋主是誰？</h2>
              <PersonForm onAdd={(p) => addPerson(p)} label={persons.length ? '再加一位（例如女屋主）' : '新增屋主'} />
              {persons.map((p) => {
                const by = fengshuiYearOf(new Date(p.birthDate + 'T12:00:00')).year
                const r = analyzePerson(by, p.gender)
                const compat = report ? r.group === report.house.group : null
                return (
                  <ResultCard key={p.id} title={p.name} sub={`${by} 年生，命卦${PALACES[r.gua].zh}，${groupZh(r.group)}命`} action={<button className="text-zinc-400" onClick={() => removePerson(p.id)} aria-label="移除"><Trash2 className="size-4" /></button>}>
                    {compat != null && <p className={compat ? 'text-brand' : 'text-zinc-300'}>{compat ? '和這間房子同一組，順。' : '和房子不同組。床頭、書桌朝自己的吉方就補得回來。'}</p>}
                    <div className="flex flex-wrap gap-1.5"><Tag tone="good">宜朝 {r.bestDirections.slice(0, 2).map((d) => `${PALACES[d].direction}（${WANDERING_STARS[r.stars[d]].zh}）`).join('、')}</Tag><Tag tone="bad">避開 {r.worstDirections.slice(0, 2).map((d) => PALACES[d].direction).join('、')}</Tag></div>
                    <MiniGrid door={facingPalace ?? undefined} cells={Object.fromEntries([...r.worstDirections.map((d) => [d, { label: WANDERING_STARS[r.stars[d]].zh, tone: 'bad' }]), ...r.bestDirections.map((d) => [d, { label: WANDERING_STARS[r.stars[d]].zh, tone: 'good' }])])} />
                  </ResultCard>
                )
              })}
            </section>
          )}

          {step === 2 && report && (
            <section className="mt-5 space-y-4">
              <h2 className="text-xl font-semibold">{report.year} 年要注意的</h2>
              <ResultCard title={`五黃在${palaceLabel(report.annual.data.wuhuang)}，二黑在${palaceLabel(report.annual.data.erhei)}`} sub="今年不動土、不裝修、不釘釘子，保持安靜整潔">
                <div className="flex flex-wrap gap-1.5"><Tag tone="good">八白財星 {palaceLabel(report.annual.data.babai)}</Tag><Tag tone="good">九紫喜慶 {palaceLabel(report.annual.data.jiuzi)}</Tag><Tag tone="muted">太歲 {report.annual.data.taisui.taisuiMountain}山</Tag><Tag tone="muted">三煞 {report.annual.data.taisui.sanshaBranches.join('')}</Tag></div>
                <MiniGrid door={report.xuankong.chart.facingPalace} cells={Object.fromEntries(report.xuankong.palaces.map((p) => [p.palace, { label: NINE_STARS[p.annualStar]!.zh, tone: [5, 2].includes(p.annualStar) ? 'bad' : [8, 9].includes(p.annualStar) ? 'good' : [3, 7].includes(p.annualStar) ? 'muted' : 'plain' }]))} />
                {report.persons.some((p) => p.offendingTaisui) && <p className="text-rose-300">{report.persons.filter((p) => p.offendingTaisui).map((p) => `${p.person.name}屬${p.zodiac}，今年${p.offendingTaisui}`).join('；')}，凡事穩一點。</p>}
              </ResultCard>
            </section>
          )}

          {step === 3 && report && (
            <section className="mt-5 space-y-4">
              <h2 className="text-xl font-semibold">房間在家的哪個方位？</h2>
              <p className="text-sm text-zinc-400">站在家正中央往那間房看。不用畫圖，加幾間分析幾間。</p>
              {lite.rooms.map((r) => {
                const pe = report.xuankong.palaces.find((p) => p.palace === r.palace)!
                const item = report.bazhai.items.find((it) => it.itemId === `lite_${r.id}_${keyItemOf(r.type) ?? ''}`)
                const q = FACING_QUESTION[r.type]
                return (
                  <ResultCard key={r.id} title={ROOM_ZH[r.type]} sub={`在${PALACES[r.palace].direction}方，${PALACES[r.palace].zh}宮`} action={<button className="text-zinc-400" onClick={() => removeLiteRoom(r.id)} aria-label="移除"><Trash2 className="size-4" /></button>}>
                    {q && (<div><div className="mb-1.5 text-xs text-zinc-400">{q}</div><DirectionPad size="sm" value={r.facing ?? null} onChange={(t) => updateLiteRoom(r.id, { facing: t })} center={<span className="text-xs text-zinc-500">朝向</span>} /></div>)}
                    <div className="flex flex-wrap gap-1.5">
                      <Tag tone={pe.combo.rating === 'great' || pe.combo.rating === 'good' ? 'good' : pe.combo.rating === 'neutral' ? 'plain' : 'bad'}>飛星 {pe.mountainStar}{pe.waterStar} {RATING_ZH[pe.combo.rating]}</Tag>
                      <Tag tone={[5, 2].includes(pe.annualStar) ? 'bad' : [8, 9].includes(pe.annualStar) ? 'good' : 'plain'}>今年{NINE_STARS[pe.annualStar]!.zh}</Tag>
                      {primary && <Tag tone={WANDERING_STARS[primary.stars[r.palace]].auspicious ? 'good' : 'bad'}>{primary.person.name} {WANDERING_STARS[primary.stars[r.palace]].zh}</Tag>}
                    </div>
                    {item && item.perPerson.map((pp) => <p key={pp.personId} className={pp.verdict === 'good' ? 'text-brand' : 'text-rose-300'}>{item.label.replace(/（.+）/, '')}對{pp.name}是{pp.note}{pp.verdict === 'bad' ? '，建議改朝吉方。' : '，很好。'}</p>)}
                    {[5, 2].includes(pe.annualStar) && <p className="text-zinc-300">今年{NINE_STARS[pe.annualStar]!.zh}到這裡，少動土、保持安靜整潔。</p>}
                  </ResultCard>
                )
              })}
              <AddRoom onAdd={(type, palace) => addLiteRoom({ type, palace })} taken={lite.rooms.map((r) => r.palace)} />
            </section>
          )}

          {step === 4 && report && (
            <section className="mt-5 space-y-4">
              <h2 className="text-xl font-semibold">目前 {report.scores.overall} 分，接下來？</h2>
              <p className="text-sm text-zinc-400">{hasRealPlan ? '你已經有一張平面圖，報告會以它為準，並加上門沖床、樑壓床這些位置關係。' : '到這裡已經能看清單。想看門沖床、樑壓床這些位置關係，就需要一張平面圖。'}</p>
              <div className="space-y-2">
                <Link to="/report" className="block"><Button variant="brand" size="lg" className="w-full">看怎麼做（清單）</Button></Link>
                <Link to="/story" className="block"><Button variant="outline" size="lg" className="w-full">讓師傅帶我 3D 看一遍</Button></Link>
                <Link to="/plan/wizard" className="block"><Button variant="outline" size="lg" className="w-full">畫平面圖（精靈，一分鐘）</Button></Link>
                <Link to="/scan" className="block"><Button variant="ghost" size="lg" className="w-full">用手機鏡頭掃描房子</Button></Link>
              </div>
            </section>
          )}
        </div>
      </main>

      {step < 4 && (
        <footer className="relative z-10 shrink-0 border-t border-white/10 bg-[#0f1013]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-md gap-2">
            <Button variant="outline" size="lg" className="border-white/15 bg-white/5 text-zinc-100" onClick={() => go(step - 1)} disabled={step === 0} aria-label="上一步"><ArrowLeft /></Button>
            <Button variant="brand" size="lg" className="flex-1" disabled={(step === 0 && house.facingSource === 'none') || (step === 1 && !persons.length)} onClick={() => go(step + 1)}>
              {step === 3 && !lite.rooms.length ? '先跳過' : `下一步：${STEPS[step + 1]}`}<ArrowRight />
            </Button>
          </div>
        </footer>
      )}
    </div>
  )
}

function ResultCard({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="sheet-enter space-y-3 rounded-2xl border border-white/10 bg-white/6 p-4 text-sm leading-relaxed">
      <div className="flex items-start justify-between gap-2">
        <div><div className="text-base font-semibold">{title}</div>{sub && <div className="text-xs text-zinc-400">{sub}</div>}</div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Tag({ tone, children }: { tone: 'good' | 'info' | 'bad' | 'muted' | 'plain'; children: ReactNode }) {
  const c = { good: 'bg-brand/20 text-brand', info: 'bg-sky-500/20 text-sky-200', bad: 'bg-rose-500/20 text-rose-200', muted: 'bg-white/10 text-zinc-300', plain: 'bg-white/5 text-zinc-400' }[tone]
  return <span className={cn('inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium', c)}>{children}</span>
}

function PersonForm({ onAdd, label }: { onAdd: (p: { name: string; birthDate: string; gender: 'male' | 'female' }) => void; label: string }) {
  const [name, setName] = useState('')
  const [birth, setBirth] = useState('1990-01-01')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const cls = 'border-white/15 bg-black/20 text-zinc-100'
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/6 p-3">
      <Input className={cls} placeholder="稱呼（例：爸爸）" value={name} onChange={(e) => setName(e.target.value)} />
      <NativeSelect className={cls} value={gender} onChange={(e) => setGender(e.target.value as 'male' | 'female')}><option value="male">男</option><option value="female">女</option></NativeSelect>
      <Input type="date" className={cn('col-span-2', cls)} value={birth} onChange={(e) => setBirth(e.target.value)} />
      <Button variant="brand" className="col-span-2" onClick={() => { if (!birth) return; onAdd({ name: name.trim() || '屋主', birthDate: birth, gender }); setName('') }}><Plus />{label}</Button>
    </div>
  )
}

function AddRoom({ onAdd, taken }: { onAdd: (type: RoomType, palace: Trigram) => void; taken: Trigram[] }) {
  const [type, setType] = useState<RoomType>('master')
  const [palace, setPalace] = useState<Trigram | null>(null)
  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-white/20 p-4">
      <div className="text-sm font-medium">加一間房</div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">{ROOM_CHOICES.map((t) => <button key={t} onClick={() => setType(t)} className={cn('shrink-0 rounded-lg border px-3 py-1.5 text-sm', type === t ? 'border-brand bg-brand/20' : 'border-white/15 text-zinc-300')}>{ROOM_ZH[t]}</button>)}</div>
      <div className="text-xs text-zinc-400">{ROOM_ZH[type]}在家的哪個方位？（上方為北）</div>
      <DirectionPad size="sm" value={palace} onChange={setPalace} dim={taken} center={<span className="text-xs text-zinc-500">中</span>} />
      <Button variant="brand" className="w-full" disabled={!palace} onClick={() => { if (palace) { onAdd(type, palace); setPalace(null) } }}><Plus />加入{ROOM_ZH[type]}</Button>
    </div>
  )
}

/** Nine-palace grid (north up) with a label per cell. */
function MiniGrid({ cells, door }: { cells: Partial<Record<Trigram, { label: string; tone: 'good' | 'info' | 'bad' | 'muted' | 'plain' }>>; door?: Trigram }) {
  const grid: (Trigram | 'center')[][] = [['qian', 'kan', 'gen'], ['dui', 'center', 'zhen'], ['kun', 'li', 'xun']]
  const tone = { good: 'bg-brand/25 text-brand', info: 'bg-sky-500/25 text-sky-200', bad: 'bg-rose-500/25 text-rose-200', muted: 'bg-white/10 text-zinc-300', plain: 'bg-white/5 text-zinc-400' }
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        {grid.flat().map((t) => {
          const c = t === 'center' ? undefined : cells[t]
          return (
            <div key={t} className={cn('flex h-16 flex-col items-center justify-center rounded-lg text-sm', c ? tone[c.tone] : 'bg-white/5 text-zinc-500', t === door && 'ring-2 ring-white/70')}>
              <span className="font-medium">{t === 'center' ? '中' : PALACES[t].direction}</span>
              {c && <span className="text-xs">{c.label}</span>}
              {t === door && <span className="text-[10px] text-zinc-200">大門</span>}
            </div>
          )
        })}
      </div>
      <p className="mt-1 text-right text-[11px] text-zinc-500">上方為北</p>
    </div>
  )
}
