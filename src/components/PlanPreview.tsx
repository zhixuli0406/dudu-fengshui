import type { ReactNode } from 'react'
import { ITEM_ZH, ROOM_ZH, type FloorPlan } from '../engine/floorplan'
import { bbox, polygonCentroid, rectCorners } from '../engine/geometry'
import { cn } from '../lib/utils'

const ROOM_FILL: Record<string, string> = {
  living: 'color-mix(in oklch, var(--el-earth) 18%, transparent)', master: 'color-mix(in oklch, var(--el-water) 22%, transparent)', bedroom: 'color-mix(in oklch, var(--el-water) 16%, transparent)', kids: 'color-mix(in oklch, var(--el-water) 12%, transparent)',
  study: 'color-mix(in oklch, var(--el-wood) 18%, transparent)', kitchen: 'color-mix(in oklch, var(--el-fire) 16%, transparent)', dining: 'color-mix(in oklch, var(--el-earth) 24%, transparent)', bathroom: 'color-mix(in oklch, var(--el-metal) 32%, transparent)',
  entry: 'color-mix(in oklch, var(--el-earth) 10%, transparent)', balcony: 'color-mix(in oklch, var(--el-wood) 10%, transparent)', altar: 'color-mix(in oklch, var(--el-fire) 12%, transparent)', storage: 'color-mix(in oklch, var(--muted-foreground) 16%, transparent)',
  corridor: 'color-mix(in oklch, var(--muted-foreground) 8%, transparent)', driveway: 'color-mix(in oklch, var(--foreground) 25%, transparent)', void: 'color-mix(in oklch, var(--foreground) 40%, transparent)', other: 'color-mix(in oklch, var(--muted-foreground) 10%, transparent)',
}
export const ROOM_FILL_CSS = ROOM_FILL

/** Static SVG preview of a plan (used by the wizard). Children are drawn in plan coordinates. */
export function PlanPreview({ plan, className, children, pad = 40 }: { plan: FloorPlan; className?: string; children?: ReactNode; pad?: number }) {
  const pts = plan.outline.length >= 3 ? plan.outline : [{ x: 0, y: 0 }, { x: 1000, y: 800 }]
  const b = bbox(pts)
  const w = Math.max(1, b.maxX - b.minX), h = Math.max(1, b.maxY - b.minY)
  const fs = Math.max(w, h) / 24
  return (
    <svg viewBox={`${b.minX - pad} ${b.minY - pad} ${w + pad * 2} ${h + pad * 2}`} className={cn('w-full rounded-xl border border-surface-border bg-surface', className)} preserveAspectRatio="xMidYMid meet">
      {plan.rooms.map((r) => r.polygon.length >= 3 && (
        <g key={r.id}>
          <polygon points={r.polygon.map((p) => `${p.x},${p.y}`).join(' ')} fill={ROOM_FILL[r.type]} stroke="var(--muted-foreground)" strokeWidth={fs / 8} />
          <text x={polygonCentroid(r.polygon).x} y={polygonCentroid(r.polygon).y + fs * 0.35} textAnchor="middle" fontSize={fs} fill="var(--foreground)" opacity={0.85}>{r.name || ROOM_ZH[r.type]}</text>
        </g>
      ))}
      {plan.outline.length >= 3 && <polygon points={plan.outline.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--foreground)" strokeWidth={fs / 4} strokeLinejoin="round" />}
      {plan.items.map((i) => {
        const c = rectCorners(i)
        const cx = i.x + i.w / 2, cy = i.y + i.h / 2
        return (
          <g key={i.id}>
            <polygon points={c.map((p) => `${p.x},${p.y}`).join(' ')} fill="var(--surface)" stroke="var(--foreground)" strokeWidth={fs / 8} />
            <text x={cx} y={cy + fs * 0.32} textAnchor="middle" fontSize={Math.min(fs * 0.9, Math.max(i.w, i.h) * 0.5)} fill="var(--foreground)">{ITEM_ZH[i.type][0]}</text>
          </g>
        )
      })}
      {children}
    </svg>
  )
}
