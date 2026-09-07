import { useState } from 'react'
import { PlanPreview, ROOM_FILL_CSS } from '../components/PlanPreview'
import { NorthArrow } from '../components/NorthArrow'
import { ITEM_ZH, ROOM_ZH, type FloorPlan, type Item, type ItemType, type Room, type RoomType } from '../engine/floorplan'
import type { Corner } from '../engine/wizard'
import type { DerivedPlan } from '../engine/wizardPlan'
import { edgeDirectionZh, placeAtWall } from '../engine/placement'
import { bbox, polygonCentroid, rectCorners } from '../engine/geometry'
import type { WizardState } from '../store/useAppStore'
import { BRUSHES } from './script'
import { Escape, choiceCls } from './Scene'
import { cn } from '../lib/utils'

const CORNERS: { value: Corner; label: string }[] = [{ value: 'tl', label: '左上' }, { value: 'tr', label: '右上' }, { value: 'bl', label: '左下' }, { value: 'br', label: '右下' }]
const DOOR_POS: { key: 'left' | 'mid' | 'right'; label: string; t: number }[] = [{ key: 'left', label: '左邊', t: 0.2 }, { key: 'mid', label: '中間', t: 0.5 }, { key: 'right', label: '右邊', t: 0.8 }]

/** How big the house is, seen from the doorway looking in; the door always sits on the bottom wall of the sketch. */
export function SizeStep({ wizard, setWizard, derived, onNext, onUseExisting, upper = false }: { wizard: WizardState; setWizard: (p: Partial<WizardState>) => void; derived: DerivedPlan; onNext: () => void; onUseExisting?: () => void; upper?: boolean }) {
  const doorPos = wizard.doorT < 0.35 ? 'left' : wizard.doorT > 0.65 ? 'right' : 'mid'
  const ping = Math.round((wizard.widthM * wizard.depthM) / 3.3058)
  return (
    <div className="space-y-3">
      <Stepper label="左右多寬" value={wizard.widthM} onChange={(v) => setWizard({ widthM: v })} />
      <Stepper label="往裡多深" value={wizard.depthM} onChange={(v) => setWizard({ depthM: v })} />
      <div className="text-xs text-zinc-400">約 {ping} 坪。不用很準，之後可以微調。</div>
      <div>
        <div className="mb-1.5 text-xs text-zinc-400">{upper ? '樓梯口在這面牆的' : '大門在這面牆的'}</div>
        <div className="grid grid-cols-3 gap-2">{DOOR_POS.map((p) => <button key={p.key} className={choiceCls(doorPos === p.key)} onClick={() => setWizard({ doorT: p.t })}>{p.label}</button>)}</div>
      </div>
      {wizard.shape === 'L' && (
        <div>
          <div className="mb-1.5 text-xs text-zinc-400">缺角在</div>
          <div className="grid grid-cols-4 gap-2">{CORNERS.map((c) => <button key={c.value} className={choiceCls(wizard.corner === c.value)} onClick={() => setWizard({ corner: c.value })}>{c.label}</button>)}</div>
        </div>
      )}
      <PlanPreview plan={{ ...derived.plan, rooms: [], items: [derived.entry] }} className="max-h-48"><YouAreHere door={derived.entry} /><NorthArrow plan={derived.plan} /></PlanPreview>
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
      <PlanPreview plan={{ ...derived.plan, items: [derived.entry] }} className="max-h-[48vh] touch-none">
        {derived.cells.map((c) => {
          const k = `${c.col},${c.row}`
          const t = wizard.paint[k]
          return <rect key={k} x={c.x + 2} y={c.y + 2} width={c.w - 4} height={c.h - 4} rx={6} fill={t ? 'transparent' : 'rgba(255,255,255,0.04)'} stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeDasharray="6 4" className="cursor-pointer" onPointerDown={() => setWizard({ paint: { ...wizard.paint, [k]: t === brush ? undefined : brush } })} />
        })}
        <YouAreHere door={derived.entry} /><NorthArrow plan={derived.plan} />
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

/**
 * Where the key piece of one room is: the room is shown on its own, you stand in the middle, and you tap
 * the stretch of wall it is against (any polygon, any angle, corners included). Bed head / desk face that
 * wall, everything else has its back to it; each wall is labelled with its compass direction.
 */
export function RoomTapStep({ room, plan, itemType, onPlace, onSkip }: { room: Room; plan: FloorPlan; itemType: ItemType; onPlace: (item: Omit<Item, 'id'>) => void; onSkip: () => void }) {
  const [placed, setPlaced] = useState<ReturnType<typeof placeAtWall>>(null)
  const b = bbox(room.polygon)
  const pad = Math.max(90, Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.28)
  const vb = { x: b.minX - pad, y: b.minY - pad, w: b.maxX - b.minX + pad * 2, h: b.maxY - b.minY + pad * 2 }
  const c = polygonCentroid(room.polygon)
  const fs = Math.max(vb.w, vb.h) / 20
  const name = ITEM_ZH[itemType].split('／')[0]!
  const headWord = itemType === 'bed' ? '床頭' : itemType === 'desk' ? '書桌' : name
  const toPlan = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const scale = r.width && r.height ? Math.min(r.width / vb.w, r.height / vb.h) : 1
    const offX = r.width ? (r.width - vb.w * scale) / 2 : 0, offY = r.height ? (r.height - vb.h * scale) / 2 : 0
    return { x: vb.x + (e.clientX - r.left - offX) / scale, y: vb.y + (e.clientY - r.top - offY) / scale }
  }
  const openings = plan.items.filter((i) => i.roomId === room.id && (i.type === 'door' || i.type === 'window'))
  const others = plan.items.filter((i) => i.roomId === room.id && i.type !== itemType && i.type !== 'door' && i.type !== 'window')
  const dir = (deg: number) => ({ x: Math.sin((deg * Math.PI) / 180), y: -Math.cos((deg * Math.PI) / 180) })
  const pts = (it: { x: number; y: number; w: number; h: number; facing: number }) => rectCorners(it).map((q) => `${q.x},${q.y}`).join(' ')
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-300">站在{ROOM_ZH[room.type]}中央看。點{headWord}靠的那一段牆；靠角落就點靠角落的位置。</p>
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} data-vb={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet" className="w-full max-h-[44vh] cursor-crosshair touch-none rounded-xl border border-white/10 bg-white/[0.03]" role="img" aria-label={`${ROOM_ZH[room.type]}平面`} onPointerDown={(e) => setPlaced(placeAtWall(room, itemType, toPlan(e)))}>
        <polygon points={room.polygon.map((q) => `${q.x},${q.y}`).join(' ')} fill="color-mix(in oklch, var(--brand) 14%, transparent)" stroke="rgba(255,255,255,0.75)" strokeWidth={fs / 5} strokeLinejoin="round" />
        {room.polygon.map((a, i) => {
          const bq = room.polygon[(i + 1) % room.polygon.length]!
          const mid = { x: (a.x + bq.x) / 2, y: (a.y + bq.y) / 2 }
          let n = { x: -(bq.y - a.y), y: bq.x - a.x }
          const len = Math.hypot(n.x, n.y) || 1
          n = { x: n.x / len, y: n.y / len }
          if ((c.x - mid.x) * n.x + (c.y - mid.y) * n.y > 0) n = { x: -n.x, y: -n.y }
          if (Math.hypot(bq.x - a.x, bq.y - a.y) < fs * 2) return null
          return <text key={i} x={mid.x + n.x * fs * 1.1} y={mid.y + n.y * fs * 1.1 + fs * 0.35} textAnchor="middle" fontSize={fs * 0.85} fill="rgba(255,255,255,0.55)">{edgeDirectionZh(room.polygon, i, plan.northOffset)}</text>
        })}
        {openings.map((i) => <polygon key={i.id} points={pts(i)} fill="#efe7d6" stroke="none" />)}
        {others.map((i) => <g key={i.id}><polygon points={pts(i)} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.35)" strokeWidth={fs / 10} /><text x={i.x + i.w / 2} y={i.y + i.h / 2 + fs * 0.3} textAnchor="middle" fontSize={fs * 0.8} fill="rgba(255,255,255,0.6)">{ITEM_ZH[i.type][0]}</text></g>)}
        <circle cx={c.x} cy={c.y} r={fs * 0.9} fill="var(--brand)" />
        <text x={c.x} y={c.y + fs * 0.32} textAnchor="middle" fontSize={fs * 0.9} fill="var(--brand-foreground)">你</text>
        {placed && (() => {
          const cx = placed.x + placed.w / 2, cy = placed.y + placed.h / 2
          const d = dir(placed.facing)
          const tip = { x: cx + d.x * placed.h * 0.55, y: cy + d.y * placed.h * 0.55 }
          return (
            <g pointerEvents="none">
              <polygon points={pts(placed)} fill="color-mix(in oklch, var(--brand) 45%, transparent)" stroke="var(--brand)" strokeWidth={fs / 6} strokeLinejoin="round" />
              <line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke="#efe7d6" strokeWidth={fs / 6} strokeLinecap="round" />
              <text x={tip.x + d.x * fs} y={tip.y + d.y * fs + fs * 0.35} textAnchor="middle" fontSize={fs * 0.85} fill="#efe7d6">{itemType === 'bed' ? '床頭' : itemType === 'desk' ? '面向' : '正面'}</text>
            </g>
          )
        })()}
      </svg>
      {placed
        ? <button className={choiceCls(true)} onClick={() => { const { edge, ...item } = placed; void edge; onPlace(item) }}>{headWord}靠{edgeDirectionZh(room.polygon, placed.edge.i, plan.northOffset)}牆，就這樣</button>
        : <p className="text-center text-xs text-zinc-500">還沒點。點了會先畫給你看，再確認。</p>}
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
