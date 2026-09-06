import type { FloorPlan } from '../engine/floorplan'
import { polygonCentroid } from '../engine/geometry'

/** Arrow from the plan centre toward compass north, drawn in plan coordinates (for PlanPreview children). */
export function NorthArrow({ plan }: { plan: FloorPlan }) {
  if (plan.outline.length < 3) return null
  const c = polygonCentroid(plan.outline)
  const r = Math.max(...plan.outline.map((p) => Math.hypot(p.x - c.x, p.y - c.y))) * 0.9
  const a = ((-plan.northOffset - 90) * Math.PI) / 180
  const x = c.x + r * Math.cos(a), y = c.y + r * Math.sin(a)
  return <g pointerEvents="none"><line x1={c.x} y1={c.y} x2={x} y2={y} stroke="var(--destructive)" strokeWidth={r / 60} strokeOpacity={0.7} /><text x={x} y={y - r / 20} textAnchor="middle" fontSize={r / 8} fill="var(--destructive)">N</text></g>
}
