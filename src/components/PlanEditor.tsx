import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { ITEM_DEFAULT, ITEM_ZH, ROOM_ZH, type FloorPlan, type Item, type ItemType, type Room, type RoomType } from '../engine/floorplan'
import { bbox, polygonCentroid, type Point } from '../engine/geometry'
import { NineGridOverlay, type PalaceOverlayInfo } from './NineGridOverlay'
import type { Trigram } from '../engine/bagua'

export type EditorMode = 'select' | 'outline' | 'room' | 'item' | 'calibrate'

export interface EditorProps {
  plan: FloorPlan
  mode: EditorMode
  roomType: RoomType
  itemType: ItemType
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAddOutlinePoint: (p: Point) => void
  onMoveOutlinePoint: (index: number, p: Point) => void
  onAddRoom: (room: Omit<Room, 'id'>) => void
  onAddItem: (item: Omit<Item, 'id'>) => void
  onUpdateItem: (id: string, patch: Partial<Item>) => void
  overlay: 'none' | 'pie' | 'grid'
  overlayInfo?: Partial<Record<Trigram, PalaceOverlayInfo>>
  marks?: Point[][]
  highlightIds?: string[]
  /** calibrate mode: two picked points (plan cm) */
  calibratePoints?: Point[]
  onCalibratePoint?: (p: Point) => void
}

const ITEM_COLOR: Record<ItemType, string> = {
  mainDoor: '#d6b35c', door: '#b8933f', window: '#2f6fb0', bed: '#7c5cbf', stove: '#d9483b', sink: '#2f6fb0', fridge: '#9aa3ad', toilet: '#5b8fb9',
  desk: '#3f8f4a', sofa: '#8b6b4a', mirror: '#a7d8ff', beam: '#6b7280', altar: '#c0392b', stairs: '#6b7280', elevator: '#6b7280', aquarium: '#2f6fb0', column: '#6b7280', tv: '#444', plant: '#3f8f4a', lamp: '#f2c94c',
}
const ITEM_ICON: Partial<Record<ItemType, string>> = { mainDoor: '門', door: '门', window: '窗', bed: '床', stove: '灶', sink: '槽', fridge: '冰', toilet: '廁', desk: '桌', sofa: '沙', mirror: '鏡', beam: '樑', altar: '神', stairs: '梯', elevator: '電', aquarium: '魚', column: '柱', tv: '視', plant: '植', lamp: '燈' }
const ROOM_FILL: Record<RoomType, string> = {
  living: 'color-mix(in oklch, var(--el-earth) 14%, transparent)', bedroom: 'color-mix(in oklch, var(--el-water) 14%, transparent)', master: 'color-mix(in oklch, var(--el-water) 20%, transparent)', kids: 'color-mix(in oklch, var(--el-water) 10%, transparent)', study: 'color-mix(in oklch, var(--el-wood) 14%, transparent)', kitchen: 'color-mix(in oklch, var(--el-fire) 14%, transparent)', dining: 'color-mix(in oklch, var(--el-earth) 18%, transparent)', bathroom: 'color-mix(in oklch, var(--el-metal) 30%, transparent)', entry: 'color-mix(in oklch, var(--el-earth) 8%, transparent)', balcony: 'color-mix(in oklch, var(--el-wood) 8%, transparent)', altar: 'color-mix(in oklch, var(--el-fire) 10%, transparent)', storage: 'color-mix(in oklch, var(--muted-foreground) 16%, transparent)', corridor: 'color-mix(in oklch, var(--muted-foreground) 8%, transparent)', driveway: 'color-mix(in oklch, var(--foreground) 25%, transparent)', void: 'color-mix(in oklch, var(--foreground) 40%, transparent)', other: 'color-mix(in oklch, var(--muted-foreground) 10%, transparent)',
}

export function PlanEditor(props: EditorProps) {
  const { plan, mode, roomType, itemType, selectedId, onSelect, onAddOutlinePoint, onMoveOutlinePoint, onAddRoom, onAddItem, onUpdateItem, overlay, overlayInfo, marks, highlightIds, calibratePoints, onCalibratePoint } = props
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState({ x: -200, y: -200, w: 1400, h: 1400 })
  const [drag, setDrag] = useState<null | { kind: 'pan'; start: Point; view0: typeof view } | { kind: 'item'; id: string; offset: Point } | { kind: 'vertex'; index: number } | { kind: 'room'; start: Point; cur: Point }>(null)
  const pointers = useRef(new Map<number, Point>())
  const pinch = useRef<{ d0: number; view0: typeof view; c0: Point } | null>(null)
  const grid = plan.gridCm || 50
  const snap = useCallback((v: number) => Math.round(v / (grid / 2)) * (grid / 2), [grid])

  // fit view to outline on first render / when outline changes
  const outlineKey = plan.outline.map((p) => `${p.x},${p.y}`).join(';') + (plan.underlay ? `|u${plan.underlay.pxW}x${plan.underlay.cmPerPx}` : '')
  useEffect(() => {
    const u = plan.underlay
    const pts = plan.outline.length >= 3 ? plan.outline : u ? [{ x: u.x, y: u.y }, { x: u.x + u.pxW * u.cmPerPx, y: u.y + u.pxH * u.cmPerPx }] : []
    if (pts.length < 2) return
    const b = bbox(pts)
    const w = b.maxX - b.minX, h = b.maxY - b.minY
    const m = Math.max(w, h) * 0.35 + 150
    setView({ x: b.minX - m, y: b.minY - m, w: w + 2 * m, h: h + 2 * m })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlineKey])

  const toPlan = useCallback((e: { clientX: number; clientY: number }): Point => {
    const svg = svgRef.current!
    const rect = svg.getBoundingClientRect()
    const s = Math.max(view.w / rect.width, view.h / rect.height)
    // preserveAspectRatio xMidYMid meet
    const rw = view.w / s, rh = view.h / s
    const ox = (rect.width - rw) / 2, oy = (rect.height - rh) / 2
    return { x: view.x + (e.clientX - rect.left - ox) * s, y: view.y + (e.clientY - rect.top - oy) * s }
  }, [view])

  const center = useMemo(() => (plan.outline.length >= 3 ? polygonCentroid(plan.outline) : { x: 400, y: 300 }), [plan.outline])
  const bounds = useMemo(() => (plan.outline.length >= 3 ? bbox(plan.outline) : { minX: 0, minY: 0, maxX: 800, maxY: 600 }), [plan.outline])
  const radius = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2
  const fontSize = Math.max(14, view.w / 45)
  const hitAt = (p: Point): Item | undefined => [...plan.items].reverse().find((i) => {
    const c = { x: i.x + i.w / 2, y: i.y + i.h / 2 }
    const r = ((-(i.facing || 0)) * Math.PI) / 180
    const dx = p.x - c.x, dy = p.y - c.y
    const lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r)
    const pad = 12
    return Math.abs(lx) <= i.w / 2 + pad && Math.abs(ly) <= i.h / 2 + pad
  })

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    const p = toPlan(e)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { d0: Math.hypot(a!.x - b!.x, a!.y - b!.y), view0: view, c0: toPlan({ clientX: (a!.x + b!.x) / 2, clientY: (a!.y + b!.y) / 2 }) }
      setDrag(null)
      return
    }
    if (mode === 'calibrate') { onCalibratePoint?.(p); return }
    if (mode === 'outline') {
      // dragging existing vertex?
      const vi = plan.outline.findIndex((v) => Math.hypot(v.x - p.x, v.y - p.y) < fontSize)
      if (vi >= 0) { setDrag({ kind: 'vertex', index: vi }); return }
      onAddOutlinePoint({ x: snap(p.x), y: snap(p.y) })
      return
    }
    if (mode === 'room') { setDrag({ kind: 'room', start: { x: snap(p.x), y: snap(p.y) }, cur: { x: snap(p.x), y: snap(p.y) } }); return }
    if (mode === 'item') {
      const d = ITEM_DEFAULT[itemType]
      onAddItem({ type: itemType, x: snap(p.x) - d.w / 2, y: snap(p.y) - d.h / 2, w: d.w, h: d.h, facing: 0 })
      return
    }
    // select mode
    const hit = hitAt(p)
    if (hit) { onSelect(hit.id); setDrag({ kind: 'item', id: hit.id, offset: { x: p.x - hit.x, y: p.y - hit.y } }); return }
    const vi = plan.outline.findIndex((v) => Math.hypot(v.x - p.x, v.y - p.y) < fontSize)
    if (vi >= 0) { setDrag({ kind: 'vertex', index: vi }); return }
    const room = [...plan.rooms].reverse().find((r) => r.polygon.length >= 3 && inPoly(p, r.polygon))
    onSelect(room ? room.id : null)
    setDrag({ kind: 'pan', start: { x: e.clientX, y: e.clientY }, view0: view })
  }
  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      const k = Math.max(0.3, Math.min(4, pinch.current.d0 / d))
      const v0 = pinch.current.view0, c = pinch.current.c0
      setView({ x: c.x - (c.x - v0.x) * k, y: c.y - (c.y - v0.y) * k, w: v0.w * k, h: v0.h * k })
      return
    }
    if (!drag) return
    const p = toPlan(e)
    if (drag.kind === 'pan') {
      const svg = svgRef.current!.getBoundingClientRect()
      const s = Math.max(drag.view0.w / svg.width, drag.view0.h / svg.height)
      setView({ ...drag.view0, x: drag.view0.x - (e.clientX - drag.start.x) * s, y: drag.view0.y - (e.clientY - drag.start.y) * s })
    } else if (drag.kind === 'item') {
      onUpdateItem(drag.id, { x: snap(p.x - drag.offset.x), y: snap(p.y - drag.offset.y) })
    } else if (drag.kind === 'vertex') {
      onMoveOutlinePoint(drag.index, { x: snap(p.x), y: snap(p.y) })
    } else if (drag.kind === 'room') {
      setDrag({ ...drag, cur: { x: snap(p.x), y: snap(p.y) } })
    }
  }
  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (drag?.kind === 'room') {
      const x0 = Math.min(drag.start.x, drag.cur.x), y0 = Math.min(drag.start.y, drag.cur.y)
      const x1 = Math.max(drag.start.x, drag.cur.x), y1 = Math.max(drag.start.y, drag.cur.y)
      if (x1 - x0 >= grid && y1 - y0 >= grid) onAddRoom({ type: roomType, polygon: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] })
    }
    setDrag(null)
  }
  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const k = e.deltaY > 0 ? 1.1 : 0.9
    const c = toPlan(e)
    setView((v) => ({ x: c.x - (c.x - v.x) * k, y: c.y - (c.y - v.y) * k, w: v.w * k, h: v.h * k }))
  }

  const gridLines = useMemo(() => {
    const out: number[] = []
    const step = grid
    const x0 = Math.floor(view.x / step) * step, x1 = view.x + view.w
    for (let x = x0; x <= x1; x += step) out.push(x)
    return { xs: out, ys: (() => { const ys: number[] = []; const y0 = Math.floor(view.y / step) * step; for (let y = y0; y <= view.y + view.h; y += step) ys.push(y); return ys })() }
  }, [view, grid])

  return (
    <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="w-full h-full touch-none select-none bg-page-canvas" preserveAspectRatio="xMidYMid meet"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}>
      {/* underlay */}
      {plan.underlay && (() => { const u = plan.underlay; const w = u.pxW * u.cmPerPx, h = u.pxH * u.cmPerPx; return (
        <image href={u.dataUrl} x={u.x} y={u.y} width={w} height={h} opacity={u.opacity} preserveAspectRatio="none" transform={`rotate(${u.rotation} ${u.x + w / 2} ${u.y + h / 2})`} pointerEvents="none" />
      ) })()}
      {/* grid */}
      <g stroke="var(--surface-border)" strokeWidth={view.w / 1400}>
        {gridLines.xs.map((x) => <line key={`x${x}`} x1={x} y1={view.y} x2={x} y2={view.y + view.h} strokeOpacity={x % (grid * 2) === 0 ? 1 : 0.5} />)}
        {gridLines.ys.map((y) => <line key={`y${y}`} x1={view.x} y1={y} x2={view.x + view.w} y2={y} strokeOpacity={y % (grid * 2) === 0 ? 1 : 0.5} />)}
      </g>
      {/* rooms */}
      {plan.rooms.map((r) => r.polygon.length >= 3 && (
        <g key={r.id}>
          <polygon points={r.polygon.map((p) => `${p.x},${p.y}`).join(' ')} fill={ROOM_FILL[r.type]} stroke={selectedId === r.id ? 'var(--brand)' : 'var(--muted-foreground)'} strokeWidth={selectedId === r.id ? fontSize / 5 : fontSize / 9} />
          <text x={polygonCentroid(r.polygon).x} y={polygonCentroid(r.polygon).y - fontSize * 1.6} textAnchor="middle" fontSize={fontSize * 0.85} fill="var(--foreground)" opacity={0.8}>{r.name || ROOM_ZH[r.type]}</text>
        </g>
      ))}
      {/* outline */}
      {plan.outline.length >= 2 && (
        <polygon points={plan.outline.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--foreground)" strokeWidth={fontSize / 4} strokeLinejoin="round" />
      )}
      {mode === 'outline' && plan.outline.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={fontSize * 0.6} fill={i === 0 ? 'var(--brand)' : 'var(--surface)'} stroke="var(--foreground)" strokeWidth={2} />)}
      {mode === 'select' && plan.outline.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={fontSize * 0.35} fill="var(--muted-foreground)" />)}
      {/* room drag preview */}
      {drag?.kind === 'room' && <rect x={Math.min(drag.start.x, drag.cur.x)} y={Math.min(drag.start.y, drag.cur.y)} width={Math.abs(drag.cur.x - drag.start.x)} height={Math.abs(drag.cur.y - drag.start.y)} fill={ROOM_FILL[roomType]} stroke="var(--brand)" strokeDasharray="8 6" strokeWidth={fontSize / 8} />}
      {/* overlay */}
      {overlay !== 'none' && plan.outline.length >= 3 && <NineGridOverlay center={center} radius={radius} northOffset={plan.northOffset} style={overlay} bounds={bounds} info={overlayInfo} fontSize={fontSize} />}
      {/* items */}
      {plan.items.map((i) => {
        const cx = i.x + i.w / 2, cy = i.y + i.h / 2
        const sel = selectedId === i.id
        const hl = highlightIds?.includes(i.id)
        return (
          <g key={i.id} transform={`rotate(${i.facing} ${cx} ${cy})`}>
            <rect x={i.x} y={i.y} width={i.w} height={i.h} rx={fontSize / 6} fill={ITEM_COLOR[i.type]} fillOpacity={i.type === 'beam' ? 0.35 : 0.75} stroke={sel ? 'var(--brand)' : hl ? 'var(--destructive)' : 'var(--surface)'} strokeWidth={sel || hl ? fontSize / 5 : fontSize / 12} />
            {/* facing arrow */}
            <polygon points={`${cx},${i.y - fontSize * 0.9} ${cx - fontSize * 0.4},${i.y - fontSize * 0.2} ${cx + fontSize * 0.4},${i.y - fontSize * 0.2}`} fill={sel ? 'var(--brand)' : 'var(--foreground)'} />
            <text x={cx} y={cy + fontSize * 0.35} textAnchor="middle" fontSize={Math.min(fontSize, Math.max(i.w, i.h) / 2)} fill="white" transform={`rotate(${-i.facing} ${cx} ${cy})`}>{ITEM_ICON[i.type] ?? ITEM_ZH[i.type][0]}</text>
          </g>
        )
      })}
      {/* finding marks */}
      {marks?.map((m, k) => m.length >= 2 ? <line key={k} x1={m[0]!.x} y1={m[0]!.y} x2={m[1]!.x} y2={m[1]!.y} stroke="var(--destructive)" strokeWidth={fontSize / 5} strokeDasharray="10 6" pointerEvents="none" /> : m.length === 1 ? <circle key={k} cx={m[0]!.x} cy={m[0]!.y} r={fontSize} fill="none" stroke="var(--destructive)" strokeWidth={fontSize / 5} pointerEvents="none" /> : null)}
      {/* calibrate points */}
      {mode === 'calibrate' && calibratePoints?.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={fontSize * 0.6} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} pointerEvents="none" />)}
      {mode === 'calibrate' && calibratePoints && calibratePoints.length === 2 && <line x1={calibratePoints[0]!.x} y1={calibratePoints[0]!.y} x2={calibratePoints[1]!.x} y2={calibratePoints[1]!.y} stroke="var(--brand)" strokeWidth={fontSize / 5} strokeDasharray="8 6" pointerEvents="none" />}
      {/* scale bar */}
      <g transform={`translate(${view.x + view.w * 0.04} ${view.y + view.h * 0.96})`}>
        <line x1={0} y1={0} x2={100} y2={0} stroke="var(--foreground)" strokeWidth={fontSize / 6} />
        <text x={50} y={-fontSize * 0.4} textAnchor="middle" fontSize={fontSize * 0.7} fill="var(--foreground)">1 m</text>
      </g>
    </svg>
  )
}

function inPoly(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
