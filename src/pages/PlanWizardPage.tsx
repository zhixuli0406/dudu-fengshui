import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Compass, Image as ImageIcon, ScanLine, SlidersHorizontal } from 'lucide-react'
import { Page, PageHeader } from '../components/AppShell'
import { PlanPreview, ROOM_FILL_CSS } from '../components/PlanPreview'
import { Badge, Button, Field, Input, NativeSelect, Segmented } from '../components/mds'
import { useAppStore, type WizardState } from '../store/useAppStore'
import { ROOM_ZH, type RoomType } from '../engine/floorplan'
import { keyItemFor, WALL_ZH, type Wall } from '../engine/wizard'
import { deriveWizardPlan, finalizeWizardPlan } from '../engine/wizardPlan'
import { NorthArrow } from '../components/NorthArrow'
import { mountainOf } from '../engine/mountains24'
import { PALACES, TRIGRAMS_CLOCKWISE } from '../engine/bagua'
import { cn } from '../lib/utils'

const STEPS = ['大小', '大門', '朝向', '房間', '家具', '完成'] as const
const ROOM_CHOICES: RoomType[] = ['living', 'master', 'bedroom', 'kids', 'study', 'kitchen', 'dining', 'bathroom', 'entry', 'balcony', 'altar', 'storage']
const WALLS: Wall[] = ['top', 'left', 'right', 'bottom']

export function PlanWizardPage() {
  const nav = useNavigate()
  const { wizard, setWizard, setFloors, setHouse, house } = useAppStore()
  const w = wizard
  const step = w.step

  // ---- derived plan from wizard state (shared with the guided walk-through)
  const derived = useMemo(() => deriveWizardPlan(w, house.facingBearing), [w, house.facingBearing])
  const { cells, rooms, mainDoor, items, plan } = derived

  const [brush, setBrush] = useState<RoomType>('living')
  const go = (n: number) => setWizard({ step: Math.max(0, Math.min(STEPS.length - 1, n)) })
  const finish = (to: string) => { setFloors([finalizeWizardPlan(derived)]); nav(to) }

  return (
    <>
      <PageHeader title="平面圖精靈" subtitle={`第 ${step + 1} 步，共 ${STEPS.length} 步：${STEPS[step]}`} back="/plan" />
      <Page className="space-y-5">
        <ol className="flex items-center gap-1">
          {STEPS.map((s, i) => <li key={s} className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-brand' : 'bg-muted')} aria-label={s} />)}
        </ol>

        {step === 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-medium">房子大概多大？</h2>
              <p className="text-sm text-muted-foreground">填整間的最大寬度與深度（公尺），不必很準，之後可以微調。從門口進來看，上方是離大門最遠的一側。</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="寬（公尺）"><Input type="number" step="0.5" min={2} value={w.widthM} onChange={(e) => setWizard({ widthM: Number(e.target.value) || w.widthM })} /></Field>
              <Field label="深（公尺）"><Input type="number" step="0.5" min={2} value={w.depthM} onChange={(e) => setWizard({ depthM: Number(e.target.value) || w.depthM })} /></Field>
            </div>
            <Field label="形狀">
              <Segmented value={w.shape} onValueChange={(v) => setWizard({ shape: v })} className="w-full" size="lg" options={[{ value: 'rect', label: '方形' }, { value: 'L', label: 'L 形（缺一角）' }]} />
            </Field>
            {w.shape === 'L' && (
              <div className="grid grid-cols-3 gap-3">
                <Field label="缺角在">
                  <NativeSelect value={w.corner} onChange={(e) => setWizard({ corner: e.target.value as WizardState['corner'] })}>
                    <option value="tl">左上</option><option value="tr">右上</option><option value="bl">左下</option><option value="br">右下</option>
                  </NativeSelect>
                </Field>
                <Field label="缺角寬（m）"><Input type="number" step="0.5" min={0.5} value={w.notchWM} onChange={(e) => setWizard({ notchWM: Number(e.target.value) || 0 })} /></Field>
                <Field label="缺角深（m）"><Input type="number" step="0.5" min={0.5} value={w.notchDM} onChange={(e) => setWizard({ notchDM: Number(e.target.value) || 0 })} /></Field>
              </div>
            )}
            <PlanPreview plan={{ ...plan, rooms: [], items: [] }} className="max-h-72" />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Link to="/scan"><Button variant="outline" className="w-full"><ScanLine />改用鏡頭掃描</Button></Link>
              <Link to="/plan?mode=calibrate"><Button variant="outline" className="w-full"><ImageIcon />改用照片描圖</Button></Link>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-medium">大門在哪面牆？</h2>
              <p className="text-sm text-muted-foreground">選牆，再用滑桿把門移到大概的位置。</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {WALLS.map((wall) => <Button key={wall} variant={w.doorWall === wall ? 'brand' : 'outline'} size="lg" onClick={() => setWizard({ doorWall: wall })}>{WALL_ZH[wall]}牆</Button>)}
            </div>
            <label className="block text-sm">位置<input type="range" min={0.05} max={0.95} step={0.01} value={w.doorT} onChange={(e) => setWizard({ doorT: Number(e.target.value) })} className="mt-1 w-full accent-[var(--brand)]" /></label>
            <PlanPreview plan={{ ...plan, rooms: [], items: [mainDoor] }} className="max-h-72" />
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-medium">站在大門內側往外看，是哪個方向？</h2>
              <p className="text-sm text-muted-foreground">最準是用手機羅盤；不方便的話直接選一個大方向也可以。</p>
            </div>
            <Link to="/compass?return=/plan/wizard"><Button variant="brand" size="lg" className="w-full"><Compass />用手機羅盤量</Button></Link>
            <div className="grid grid-cols-4 gap-2">
              {TRIGRAMS_CLOCKWISE.map((t) => <Button key={t} variant={Math.abs(((house.facingBearing - PALACES[t].bearing) % 360 + 360) % 360) < 1 && house.facingSource === 'manual' ? 'brand' : 'outline'} onClick={() => setHouse({ facingBearing: PALACES[t].bearing, facingSource: 'manual' })}>{PALACES[t].direction}</Button>)}
            </div>
            <p className="text-sm">目前：朝向 <span className="font-medium">{house.facingBearing.toFixed(0)}°</span>，向{mountainOf(house.facingBearing).name}山（{{ compass: '羅盤實測', manual: '手動選擇', ar: 'AR', none: '尚未設定，先用預設值' }[house.facingSource]}）</p>
            <PlanPreview plan={{ ...plan, rooms: [], items: [mainDoor] }} className="max-h-64">
              <NorthArrow plan={plan} />
            </PlanPreview>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-medium">把房間塗上去</h2>
              <p className="text-sm text-muted-foreground">先選房間類型，再點格子。相鄰的同色格子會自動合成一間；再點一次可清除。不必塗滿。</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">格子</span>
              <Segmented value={`${w.cols}x${w.rows}`} onValueChange={(v) => { const [c, r] = v.split('x').map(Number); setWizard({ cols: c!, rows: r!, paint: {} }) }} options={[{ value: '3x3', label: '粗' }, { value: '4x4', label: '中' }, { value: '6x5', label: '細' }]} />
              <Button variant="ghost" size="sm" onClick={() => setWizard({ paint: {} })}>全部清除</Button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {ROOM_CHOICES.map((t) => <button key={t} onClick={() => setBrush(t)} className={cn('shrink-0 rounded-lg border px-3 py-2 text-sm', brush === t ? 'border-brand ring-2 ring-brand/30' : 'border-border')} style={{ background: ROOM_FILL_CSS[t] }}>{ROOM_ZH[t]}</button>)}
            </div>
            <PlanPreview plan={{ ...plan, rooms, items: [mainDoor] }} className="max-h-[60vh]">
              {cells.map((c) => {
                const k = `${c.col},${c.row}`
                const t = w.paint[k]
                return (
                  <rect key={k} x={c.x + 2} y={c.y + 2} width={c.w - 4} height={c.h - 4} rx={6} fill={t ? 'transparent' : 'color-mix(in oklch, var(--muted-foreground) 6%, transparent)'} stroke="var(--muted-foreground)" strokeOpacity={0.35} strokeDasharray="6 4"
                    className="cursor-pointer" onPointerDown={() => setWizard({ paint: { ...w.paint, [k]: t === brush ? undefined : brush } })} />
                )
              })}
            </PlanPreview>
            <p className="text-xs text-muted-foreground">已有 {rooms.length} 個房間：{rooms.map((r) => ROOM_ZH[r.type]).join('、') || '尚未塗色'}</p>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-medium">主要家具靠哪面牆？</h2>
              <p className="text-sm text-muted-foreground">只問最影響風水的幾件：床、爐灶、馬桶、書桌、沙發。不確定可以跳過。</p>
            </div>
            {rooms.filter((r) => keyItemFor(r.type)).length === 0 && <p className="text-sm text-muted-foreground">沒有需要問的房間，直接下一步。</p>}
            <ul className="space-y-3">
              {rooms.filter((r) => keyItemFor(r.type)).map((r) => {
                const key = keyItemFor(r.type)!
                return (
                  <li key={r.id} className="rounded-xl border border-surface-border bg-surface p-3">
                    <div className="text-sm font-medium">{ROOM_ZH[r.type]}：{key.question}</div>
                    <div className="mt-2 grid grid-cols-5 gap-1.5">
                      {WALLS.map((wall) => <Button key={wall} variant={w.walls[r.id] === wall ? 'brand' : 'outline'} size="sm" onClick={() => setWizard({ walls: { ...w.walls, [r.id]: wall } })}>{WALL_ZH[wall]}</Button>)}
                      <Button variant={w.walls[r.id] ? 'ghost' : 'secondary'} size="sm" onClick={() => { const n = { ...w.walls }; delete n[r.id]; setWizard({ walls: n }) }}>跳過</Button>
                    </div>
                  </li>
                )
              })}
            </ul>
            <PlanPreview plan={plan} className="max-h-72" />
          </section>
        )}

        {step === 5 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-medium">完成了</h2>
              <p className="text-sm text-muted-foreground">這張圖已經可以分析。房門、窗戶、位置細節都可以到「微調」慢慢改。</p>
            </div>
            <PlanPreview plan={plan} className="max-h-80"><NorthArrow plan={plan} /></PlanPreview>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge variant="ghost">{w.widthM} × {w.depthM} m</Badge><Badge variant="ghost">{rooms.length} 個房間</Badge><Badge variant="ghost">{items.length} 個物件</Badge><Badge variant="ghost">朝向 {house.facingBearing.toFixed(0)}°</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="brand" size="lg" onClick={() => finish('/report')}><Check />儲存並看報告</Button>
              <Button variant="outline" size="lg" onClick={() => finish('/plan')}><SlidersHorizontal />儲存並微調</Button>
            </div>
          </section>
        )}

        {step < 5 && (
          <div className="flex gap-2">
            <Button variant="outline" size="lg" onClick={() => go(step - 1)} disabled={step === 0}><ArrowLeft />上一步</Button>
            <Button variant="brand" size="lg" className="flex-1" onClick={() => go(step + 1)}>下一步<ArrowRight /></Button>
          </div>
        )}
      </Page>
    </>
  )
}

