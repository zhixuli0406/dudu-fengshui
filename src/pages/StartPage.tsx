import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Compass, Plus, Trash2 } from 'lucide-react'
import { MasterAvatar } from '../components/MasterAvatar'
import { Button, Input, NativeSelect } from '../components/mds'
import { resolveAnalysisPlan, useAppStore } from '../store/useAppStore'
import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from '../engine/bagua'
import { analyzePerson, groupZh, WANDERING_STARS } from '../engine/bazhai'
import { fengshuiYearOf } from '../engine/calendar'
import { buildReport } from '../engine/report'
import { mountainOf } from '../engine/mountains24'
import { palaceLabel } from '../engine/annual'
import { FACING_QUESTION, keyItemOf } from '../engine/lite'
import { ROOM_ZH, type RoomType } from '../engine/floorplan'
import { NINE_STARS, RATING_ZH } from '../engine/stars'
import { cn } from '../lib/utils'

const MASTER = '嘟嘟師傅'
const ROOM_CHOICES: RoomType[] = ['master', 'bedroom', 'kids', 'kitchen', 'study', 'bathroom', 'living', 'altar']
const STEPS = ['大門', '屋主', '今年', '房間', '更準'] as const

/** 新手村：一次一個問題，答完馬上有回饋。 */
export function StartPage() {
  const nav = useNavigate()
  const { house, setHouse, persons, addPerson, removePerson, lite, addLiteRoom, updateLiteRoom, removeLiteRoom, setLiteStep, floors, plan } = useAppStore()
  const step = lite.step
  const go = (n: number) => setLiteStep(Math.max(0, Math.min(STEPS.length - 1, n)))
  const resolved = useMemo(() => resolveAnalysisPlan(floors, plan, house, lite, 'lite'), [floors, plan, house, lite])
  const hasRealPlan = floors.some((f) => f.outline.length >= 3 && !f.synthetic)
  const report = useMemo(() => { try { return buildReport(persons, { facingBearing: house.facingBearing, periodYear: house.periodYear, plan: resolved.plan, floors: resolved.floors, stoveMode: house.stoveMode, jianxiangTolerance: house.jianxiangTolerance, replacementMode: house.replacementMode }) } catch { return null } }, [persons, house, resolved])
  const primary = report?.persons.find((p) => p.person.primary) ?? report?.persons[0]

  return (
    <div className="dark fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#0f1013] text-zinc-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(46,143,110,0.25),transparent_60%)]" />
      <header className="relative z-10 flex h-12 items-center gap-2 px-3 safe-t">
        <button className="text-sm text-zinc-400" onClick={() => nav('/')}>離開</button>
        <ol className="mx-auto flex items-center gap-1">
          {STEPS.map((s, i) => <li key={s} className={cn('h-1.5 w-8 rounded-full', i <= step ? 'bg-brand' : 'bg-white/15')} aria-label={s} />)}
        </ol>
        <span className="text-xs text-zinc-500">{step + 1}/{STEPS.length}</span>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-md flex-1 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {/* 師傅 */}
        <div className="mt-2 flex items-end gap-3">
          <MasterAvatar size={72} />
          <div className="mb-2 rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg">
            {step === 0 && (house.facingSource === 'none' ? `我是${MASTER}。先告訴我，站在你家大門裡面往外看，是哪個方向？` : '好，方向有了。')}
            {step === 1 && (persons.length ? '屋主的命卦我算好了。' : '屋主是誰？出生年給我就好。')}
            {step === 2 && '今年的流年，我先講重點。'}
            {step === 3 && (lite.rooms.length ? '再加一間，或者往下看。' : '主臥在家的哪一邊？告訴我方位就好，不用畫。')}
            {step === 4 && '想更準的話，有三條路。'}
          </div>
        </div>

        {/* step 0: 大門朝向 */}
        {step === 0 && (
          <section className="mt-5 space-y-4">
            <h2 className="text-xl font-semibold">大門朝哪個方向？</h2>
            <Link to="/compass?return=/start"><Button variant="brand" size="lg" className="w-full"><Compass />用手機羅盤量（最準）</Button></Link>
            <div className="grid grid-cols-4 gap-2">
              {TRIGRAMS_CLOCKWISE.map((t) => <Button key={t} size="lg" variant={house.facingSource !== 'none' && Math.abs(((house.facingBearing - PALACES[t].bearing) % 360 + 360) % 360) < 22.5 ? 'brand' : 'outline'} onClick={() => setHouse({ facingBearing: PALACES[t].bearing, facingSource: 'manual' })}>{PALACES[t].direction}</Button>)}
            </div>
            {house.facingSource !== 'none' && report && (
              <ResultCard title={`你家是${PALACES[report.house.houseGua].zh}宅，${groupZh(report.house.group)}宅`}>
                <p>向{report.house.facing.name}山（{Math.round(house.facingBearing)}°），坐{report.house.sitting.name}。{report.period} 運的玄空盤是「{report.xuankong.patternZh}」。</p>
                <p className="mt-1"><b className="text-brand">財位</b>在{report.bazhai.wealth.map((t) => PALACES[t].direction).join('、')}，<b className="text-sky-300">文昌位</b>在{report.bazhai.wenchang.map((t) => (t as string) === 'center' ? '中宮' : PALACES[t as Trigram].direction).join('、')}，洩財位在{report.bazhai.wealthLeak.map((t) => PALACES[t].direction).join('、')}（別放魚缸）。</p>
                <MiniGrid northOffset={0} highlight={{ good: report.bazhai.wealth, info: report.bazhai.wenchang.filter((t) => (t as string) !== 'center') as Trigram[], bad: [] }} facing={report.xuankong.chart.facingPalace} />
              </ResultCard>
            )}
            <Button variant="brand" size="lg" className="w-full" disabled={house.facingSource === 'none'} onClick={() => go(1)}>下一步：屋主<ArrowRight /></Button>
          </section>
        )}

        {/* step 1: 屋主 */}
        {step === 1 && (
          <section className="mt-5 space-y-4">
            <h2 className="text-xl font-semibold">屋主是誰？</h2>
            <PersonForm onAdd={(p) => addPerson(p)} label={persons.length ? '再加一位（例如女屋主）' : '新增屋主'} />
            {persons.length > 0 && (
              <ul className="space-y-2">
                {persons.map((p) => {
                  const by = fengshuiYearOf(new Date(p.birthDate + 'T12:00:00')).year
                  const r = analyzePerson(by, p.gender)
                  const compat = report ? r.group === report.house.group : null
                  return (
                    <li key={p.id} className="rounded-xl bg-white/8 p-3 text-sm">
                      <div className="flex items-center justify-between"><span className="font-medium">{p.name}{p.primary && <span className="ml-1 text-xs text-brand">屋主</span>}</span><button className="text-zinc-400" onClick={() => removePerson(p.id)} aria-label="移除"><Trash2 className="size-4" /></button></div>
                      <p className="mt-1 text-zinc-300">{by} 年生，命卦{PALACES[r.gua].zh}，{groupZh(r.group)}命{compat != null && (compat ? '，和這間房子同一組，順。' : '，和房子不同組，床頭朝自己的吉方就補得回來。')}</p>
                      <p className="mt-1">床頭、書桌宜朝：<b className="text-brand">{r.bestDirections.slice(0, 2).map((d) => `${PALACES[d].direction}（${WANDERING_STARS[r.stars[d]].zh}）`).join('、')}</b></p>
                      <p className="text-zinc-400">避開：{r.worstDirections.slice(0, 2).map((d) => PALACES[d].direction).join('、')}</p>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="flex gap-2"><Button variant="outline" size="lg" onClick={() => go(0)}>上一步</Button><Button variant="brand" size="lg" className="flex-1" disabled={!persons.length} onClick={() => go(2)}>下一步：今年<ArrowRight /></Button></div>
          </section>
        )}

        {/* step 2: 流年 */}
        {step === 2 && report && (
          <section className="mt-5 space-y-4">
            <h2 className="text-xl font-semibold">{report.year} 年要注意的</h2>
            <ResultCard title={`五黃在${palaceLabel(report.annual.data.wuhuang)}，二黑在${palaceLabel(report.annual.data.erhei)}`}>
              <p>這兩個方位今年不動土、不裝修、不釘釘子，保持安靜整潔。</p>
              <p className="mt-1">好的星：八白財星在{palaceLabel(report.annual.data.babai)}，九紫在{palaceLabel(report.annual.data.jiuzi)}，多走動、多亮燈。</p>
              <p className="mt-1">太歲在{report.annual.data.taisui.taisuiMountain}山，三煞在{report.annual.data.taisui.sanshaBranches.join('')}。{report.persons.filter((p) => p.offendingTaisui).map((p) => `${p.person.name}今年${p.offendingTaisui}。`).join('')}</p>
              <MiniGrid northOffset={0} highlight={{ good: [report.annual.data.babai, report.annual.data.jiuzi].filter((t) => t !== 'center') as Trigram[], info: [], bad: [report.annual.data.wuhuang, report.annual.data.erhei].filter((t) => t !== 'center') as Trigram[] }} facing={report.xuankong.chart.facingPalace} />
            </ResultCard>
            <div className="flex gap-2"><Button variant="outline" size="lg" onClick={() => go(1)}>上一步</Button><Button variant="brand" size="lg" className="flex-1" onClick={() => go(3)}>下一步：房間<ArrowRight /></Button></div>
          </section>
        )}

        {/* step 3: 房間 */}
        {step === 3 && report && (
          <section className="mt-5 space-y-4">
            <h2 className="text-xl font-semibold">房間在家的哪個方位？</h2>
            <p className="text-sm text-zinc-400">站在家正中央，往那間房看是哪個方向。不用畫圖，加幾間就分析幾間。</p>
            <ul className="space-y-3">
              {lite.rooms.map((r) => {
                const pe = report.xuankong.palaces.find((p) => p.palace === r.palace)!
                const item = report.bazhai.items.find((it) => it.itemId === `lite_${r.id}_${keyItemOf(r.type) ?? ''}`)
                const q = FACING_QUESTION[r.type]
                return (
                  <li key={r.id} className="rounded-xl bg-white/8 p-3 text-sm">
                    <div className="flex items-center justify-between"><span className="font-medium">{ROOM_ZH[r.type]}，在{PALACES[r.palace].direction}</span><button className="text-zinc-400" onClick={() => removeLiteRoom(r.id)} aria-label="移除"><Trash2 className="size-4" /></button></div>
                    {q && (
                      <div className="mt-2">
                        <div className="text-xs text-zinc-400">{q}</div>
                        <div className="mt-1 grid grid-cols-4 gap-1">{TRIGRAMS_CLOCKWISE.map((t) => <Button key={t} size="sm" variant={r.facing === t ? 'brand' : 'outline'} onClick={() => updateLiteRoom(r.id, { facing: t })}>{PALACES[t].direction}</Button>)}</div>
                      </div>
                    )}
                    <p className="mt-2 text-zinc-300">這一宮的飛星山{pe.mountainStar}向{pe.waterStar}，{RATING_ZH[pe.combo.rating]}；今年{NINE_STARS[pe.annualStar]!.zh}到這裡{[5, 2].includes(pe.annualStar) ? '，今年少動它' : [8, 9].includes(pe.annualStar) ? '，是好星，多用' : ''}。</p>
                    {primary && <p className="mt-1">對{primary.person.name}來說這一方是「{WANDERING_STARS[primary.stars[r.palace]].zh}」{WANDERING_STARS[primary.stars[r.palace]].auspicious ? '，吉方。' : '，凶方，用擺設緩和就好。'}</p>}
                    {item && item.perPerson.map((pp) => <p key={pp.personId} className={cn('mt-1', pp.verdict === 'good' ? 'text-brand' : 'text-rose-300')}>{item.label.replace(/（.+）/, '')}對{pp.name}：{pp.note}{pp.verdict === 'bad' ? '，建議改朝吉方。' : '，很好。'}</p>)}
                  </li>
                )
              })}
            </ul>
            <AddRoom onAdd={(type, palace) => addLiteRoom({ type, palace })} />
            <div className="flex gap-2"><Button variant="outline" size="lg" onClick={() => go(2)}>上一步</Button><Button variant="brand" size="lg" className="flex-1" onClick={() => go(4)}>{lite.rooms.length ? '下一步' : '先跳過'}<ArrowRight /></Button></div>
          </section>
        )}

        {/* step 4: 更準 */}
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
            <Button variant="ghost" onClick={() => go(3)}>回上一步</Button>
          </section>
        )}
      </main>
    </div>
  )
}

function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="sheet-enter rounded-2xl bg-white/8 p-4 text-sm leading-relaxed"><div className="text-base font-medium">{title}</div><div className="mt-2 text-zinc-200">{children}</div></div>
}

function PersonForm({ onAdd, label }: { onAdd: (p: { name: string; birthDate: string; gender: 'male' | 'female' }) => void; label: string }) {
  const [name, setName] = useState('')
  const [birth, setBirth] = useState('1990-01-01')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/8 p-3">
      <Input className="border-white/15 bg-black/20 text-zinc-100" placeholder="稱呼（例：爸爸）" value={name} onChange={(e) => setName(e.target.value)} />
      <NativeSelect className="border-white/15 bg-black/20 text-zinc-100" value={gender} onChange={(e) => setGender(e.target.value as 'male' | 'female')}><option value="male">男</option><option value="female">女</option></NativeSelect>
      <Input type="date" className="col-span-2 border-white/15 bg-black/20 text-zinc-100" value={birth} onChange={(e) => setBirth(e.target.value)} />
      <Button variant="brandSubtle" className="col-span-2" onClick={() => { if (!birth) return; onAdd({ name: name.trim() || '屋主', birthDate: birth, gender }); setName('') }}><Plus />{label}</Button>
    </div>
  )
}

function AddRoom({ onAdd }: { onAdd: (type: RoomType, palace: Trigram) => void }) {
  const [type, setType] = useState<RoomType>('master')
  const [palace, setPalace] = useState<Trigram | null>(null)
  return (
    <div className="rounded-xl border border-dashed border-white/20 p-3">
      <div className="text-sm font-medium">加一間房</div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{ROOM_CHOICES.map((t) => <button key={t} onClick={() => setType(t)} className={cn('shrink-0 rounded-lg border px-3 py-1.5 text-sm', type === t ? 'border-brand bg-brand/20' : 'border-white/15 text-zinc-300')}>{ROOM_ZH[t]}</button>)}</div>
      <div className="mt-2 text-xs text-zinc-400">在家的哪個方位？</div>
      <div className="mt-1 grid grid-cols-4 gap-1">{TRIGRAMS_CLOCKWISE.map((t) => <Button key={t} size="sm" variant={palace === t ? 'brand' : 'outline'} onClick={() => setPalace(t)}>{PALACES[t].direction}</Button>)}</div>
      <Button variant="brand" className="mt-2 w-full" disabled={!palace} onClick={() => { if (palace) { onAdd(type, palace); setPalace(null) } }}><Plus />加入{ROOM_ZH[type]}</Button>
    </div>
  )
}

/** Tiny nine-palace grid (north up) with highlights. */
function MiniGrid({ highlight, facing }: { northOffset: number; highlight: { good: Trigram[]; info: Trigram[]; bad: Trigram[] }; facing: Trigram }) {
  const grid: (Trigram | 'center')[][] = [['qian', 'kan', 'gen'], ['dui', 'center', 'zhen'], ['kun', 'li', 'xun']]
  return (
    <div className="mt-3 grid grid-cols-3 gap-1">
      {grid.flat().map((t) => {
        const good = t !== 'center' && highlight.good.includes(t), info = t !== 'center' && highlight.info.includes(t), bad = t !== 'center' && highlight.bad.includes(t)
        return (
          <div key={t} className={cn('rounded-md px-2 py-1.5 text-center text-xs', good ? 'bg-brand/30 text-brand' : info ? 'bg-sky-500/25 text-sky-200' : bad ? 'bg-rose-500/25 text-rose-200' : 'bg-white/5 text-zinc-400', t === facing && 'ring-1 ring-white/50')}>
            {t === 'center' ? '中' : PALACES[t].direction}{t === facing && <div className="text-[10px] text-zinc-300">大門</div>}{good && <div className="text-[10px]">財位</div>}{info && <div className="text-[10px]">文昌</div>}{bad && <div className="text-[10px]">避</div>}
          </div>
        )
      })}
    </div>
  )
}

void mountainOf
