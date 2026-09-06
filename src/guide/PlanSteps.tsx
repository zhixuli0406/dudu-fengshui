import { useState } from 'react'
import { PlanPreview, ROOM_FILL_CSS } from '../components/PlanPreview'
import { NorthArrow } from '../components/NorthArrow'
import { ROOM_ZH, type FloorPlan, type Item, type Room, type RoomType } from '../engine/floorplan'
import type { Corner, Wall } from '../engine/wizard'
import { WALL_FROM_DOOR, wallDirectionZh, type DerivedPlan } from '../engine/wizardPlan'
import type { WizardState } from '../store/useAppStore'
import { BRUSHES } from './script'
import { Escape, choiceCls } from './Scene'
import { cn } from '../lib/utils'

const CORNERS: { value: Corner; label: string }[] = [{ value: 'tl', label: '左上' }, { value: 'tr', label: '右上' }, { value: 'bl', label: '左下' }, { value: 'br', label: '右下' }]
const DOOR_POS: { key: 'left' | 'mid' | 'right'; label: string; t: number }[] = [{ key: 'left', label: '左邊', t: 0.2 }, { key: 'mid', label: '中間', t: 0.5 }, { key: 'right', label: '右邊', t: 0.8 }]

/** How big the house is, seen from the doorway looking in; the door always sits on the bottom wall of the sketch. */
export function SizeStep({ wizard, setWizard, derived, onNext, onUseExisting }: { wizard: WizardState; setWizard: (p: Partial<WizardState>) => void; derived: DerivedPlan; onNext: () => void; onUseExisting?: () => void }) {
  const doorPos = wizard.doorT < 0.35 ? 'left' : wizard.doorT > 0.65 ? 'right' : 'mid'
  const ping = Math.round((wizard.widthM * wizard.depthM) / 3.3058)
  return (
    <div className="space-y-3">
      <Stepper label="左右多寬" value={wizard.widthM} onChange={(v) => setWizard({ widthM: v })} />
      <Stepper label="往裡多深" value={wizard.depthM} onChange={(v) => setWizard({ depthM: v })} />
      <div className="text-xs text-zinc-400">約 {ping} 坪。不用很準，之後可以微調。</div>
      <div>
        <div className="mb-1.5 text-xs text-zinc-400">大門在這面牆的</div>
        <div className="grid grid-cols-3 gap-2">{DOOR_POS.map((p) => <button key={p.key} className={choiceCls(doorPos === p.key)} onClick={() => setWizard({ doorT: p.t })}>{p.label}</button>)}</div>
      </div>
      {wizard.shape === 'L' && (
        <div>
          <div className="mb-1.5 text-xs text-zinc-400">缺角在</div>
          <div className="grid grid-cols-4 gap-2">{CORNERS.map((c) => <button key={c.value} className={choiceCls(wizard.corner === c.value)} onClick={() => setWizard({ corner: c.value })}>{c.label}</button>)}</div>
        </div>
      )}
      <PlanPreview plan={{ ...derived.plan, rooms: [], items: [derived.mainDoor] }} className="max-h-48"><YouAreHere door={derived.mainDoor} /><NorthArrow plan={derived.plan} /></PlanPreview>
      <button className={choiceCls(true)} onClick={onNext}>差不多這樣</button>
      {onUseExisting && <button className={choiceCls()} onClick={onUseExisting}>直接用我畫過的平面圖</button>}
      <Escape label={wizard.shape === 'L' ? '改回方形' : '房子缺一角（L 形）'} onPick={() => setWizard({ shape: wizard.shape === 'L' ? 'rect' : 'L' })} />
    </div>
  )
}

/** Paint rooms onto the sketch: pick a room type, tap cells; same-type neighbours merge into one room. */
export function PaintStep({ wizard, setWizard, derived, onDone, onSkip }: { wizard: WizardState; setWizard: (p: Partial<WizardState>) => void; derived: DerivedPlan; onDone: () => void; onSkip: () => void }) {
  const [brush, setBrush] = useState<RoomType>('living')
  const fine = wizard.cols >= 6
  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {BRUSHES.map((t) => <button key={t} onClick={() => setBrush(t)} className={cn('shrink-0 rounded-lg border px-3 py-2 text-sm text-zinc-100', brush === t ? 'border-brand ring-2 ring-brand/40' : 'border-white/15')} style={{ background: ROOM_FILL_CSS[t] }}>{ROOM_ZH[t]}</button>)}
      </div>
      <PlanPreview plan={{ ...derived.plan, items: [derived.mainDoor] }} className="max-h-[48vh] touch-none">
        {derived.cells.map((c) => {
          const k = `${c.col},${c.row}`
          const t = wizard.paint[k]
          return <rect key={k} x={c.x + 2} y={c.y + 2} width={c.w - 4} height={c.h - 4} rx={6} fill={t ? 'transparent' : 'rgba(255,255,255,0.04)'} stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeDasharray="6 4" className="cursor-pointer" onPointerDown={() => setWizard({ paint: { ...wizard.paint, [k]: t === brush ? undefined : brush } })} />
        })}
        <YouAreHere door={derived.mainDoor} /><NorthArrow plan={derived.plan} />
      </PlanPreview>
      <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
        <span className="min-w-0 truncate">{derived.rooms.length ? `已有：${derived.rooms.map((r) => ROOM_ZH[r.type]).join('、')}` : `選好「${ROOM_ZH[brush]}」，點格子塗上去`}</span>
        <span className="flex shrink-0 gap-3">
          {derived.rooms.length > 0 && <button className="underline underline-offset-4" onClick={() => setWizard({ paint: {} })}>清掉重畫</button>}
          <button className="underline underline-offset-4" onClick={() => setWizard({ cols: fine ? 4 : 6, rows: fine ? 4 : 5, paint: {} })}>{fine ? '格子粗一點' : '格子細一點'}</button>
        </span>
      </div>
      <button className={choiceCls(true, 'disabled:opacity-40')} disabled={!derived.rooms.length} onClick={onDone}>塗好了</button>
      <Escape label="先不畫房間，直接聽結論" onPick={onSkip} />
    </div>
  )
}

/** Which wall the key piece of one room is against, named from the doorway and by compass direction. */
export function WallStep({ room, plan, current, onPick, onSkip }: { room: Room; plan: FloorPlan; current?: Wall; onPick: (w: Wall) => void; onSkip: () => void }) {
  const door = plan.items.find((i) => i.type === 'mainDoor')
  const wallBtn = (w: Wall, extra?: string) => (
    <button key={w} className={choiceCls(current === w, cn('flex flex-col py-2', extra))} onClick={() => onPick(w)}>
      <span>{WALL_FROM_DOOR[w]}</span><span className="text-xs opacity-70">{wallDirectionZh(w, plan.northOffset)}</span>
    </button>
  )
  return (
    <div className="space-y-3">
      <PlanPreview plan={plan} className="max-h-48">
        <polygon points={room.polygon.map((p) => `${p.x},${p.y}`).join(' ')} fill="color-mix(in oklch, var(--brand) 25%, transparent)" stroke="var(--brand)" strokeWidth={14} strokeLinejoin="round" pointerEvents="none" />
        {door && <YouAreHere door={door} />}
      </PlanPreview>
      <div className="grid grid-cols-2 gap-2">
        {wallBtn('top', 'col-span-2')}
        {wallBtn('left')}
        {wallBtn('right')}
        {wallBtn('bottom', 'col-span-2')}
      </div>
      <Escape label="不確定，先略過" onPick={onSkip} />
    </div>
  )
}

/** A "you" marker just inside the main door, so the sketch reads from the doorway. */
function YouAreHere({ door }: { door: Item }) {
  const f = door.facing ?? 0 // door faces inward: 0 = up
  const dx = f === 90 ? 90 : f === 270 ? -90 : 0
  const dy = f === 0 ? -90 : f === 180 ? 90 : 0
  const cx = door.x + door.w / 2 + dx, cy = door.y + door.h / 2 + dy
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={44} fill="var(--brand)" />
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={40} fill="var(--brand-foreground)">你</text>
    </g>
  )
}

/** Half-metre stepper for a dimension. */
function Stepper({ label, value, onChange, min = 3, max = 40 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 2) / 2)))
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2">
      <span className="text-sm text-zinc-300">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="flex size-10 items-center justify-center rounded-full bg-white/10 text-xl active:scale-95" onClick={() => set(value - 0.5)} aria-label="減少">−</button>
        <span className="w-16 text-center font-mono text-lg tabular-nums text-[#efe7d6]">{value} m</span>
        <button type="button" className="flex size-10 items-center justify-center rounded-full bg-white/10 text-xl active:scale-95" onClick={() => set(value + 0.5)} aria-label="增加">+</button>
      </div>
    </div>
  )
}
