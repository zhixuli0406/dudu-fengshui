import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from '../engine/bagua'
import type { Point } from '../engine/geometry'
import { palaceAnchors } from '../engine/palaces'

export interface PalaceOverlayInfo {
  /** up to 3 short lines drawn in the sector */
  lines: string[]
  tone?: 'good' | 'bad' | 'neutral'
}

interface Props {
  center: Point
  radius: number
  /** house outline; sector fills are clipped to it and labels anchored inside it */
  outline?: Point[]
  northOffset: number
  style: 'pie' | 'grid'
  bounds?: { minX: number; minY: number; maxX: number; maxY: number }
  info?: Partial<Record<Trigram, PalaceOverlayInfo>>
  fontSize: number
}

const toneColor = { good: 'color-mix(in oklch, var(--brand) 18%, transparent)', bad: 'color-mix(in oklch, var(--destructive) 18%, transparent)', neutral: 'color-mix(in oklch, var(--muted-foreground) 8%, transparent)' }

/** 8 palace sectors (or a 3×3 grid) drawn around the plan centre, rotated by northOffset. */
export function NineGridOverlay({ center, radius, northOffset, style, bounds, info, fontSize, outline }: Props) {
  if (style === 'grid' && bounds) {
    const w = bounds.maxX - bounds.minX, h = bounds.maxY - bounds.minY
    const cells: { t: Trigram | 'center'; c: number; r: number }[] = []
    const grid: (Trigram | 'center')[][] = [['qian', 'kan', 'gen'], ['dui', 'center', 'zhen'], ['kun', 'li', 'xun']]
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push({ t: grid[r]![c]!, c, r })
    return (
      <g transform={`rotate(${-northOffset} ${center.x} ${center.y})`} pointerEvents="none">
        {cells.map(({ t, c, r }) => {
          const x = bounds.minX + (c * w) / 3, y = bounds.minY + (r * h) / 3
          const i = t === 'center' ? undefined : info?.[t]
          return (
            <g key={t}>
              <rect x={x} y={y} width={w / 3} height={h / 3} fill={i?.tone ? toneColor[i.tone] : 'transparent'} stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeDasharray="6 4" strokeWidth={fontSize / 10} />
              <text x={x + w / 6} y={y + fontSize * 1.2} textAnchor="middle" fontSize={fontSize} fill="var(--foreground)" transform={`rotate(${northOffset} ${x + w / 6} ${y + fontSize * 1.2})`}>{t === 'center' ? '中' : `${PALACES[t].zh}·${PALACES[t].direction}`}</text>
              {i?.lines.map((l, k) => <text key={k} x={x + w / 6} y={y + fontSize * (2.4 + k * 1.1)} textAnchor="middle" fontSize={fontSize * 0.8} fill="var(--foreground)" opacity={0.75} transform={`rotate(${northOffset} ${x + w / 6} ${y + fontSize * (2.4 + k * 1.1)})`}>{l}</text>)}
            </g>
          )
        })}
      </g>
    )
  }
  const R = radius
  const hasOutline = !!outline && outline.length >= 3
  const anchors = hasOutline ? palaceAnchors(outline!, northOffset) : null
  const clipId = `palace-clip-${Math.round(center.x)}-${Math.round(center.y)}`
  return (
    <g pointerEvents="none">
      {hasOutline && <defs><clipPath id={clipId}><polygon points={outline!.map((p) => `${p.x},${p.y}`).join(' ')} /></clipPath></defs>}
      <g clipPath={hasOutline ? `url(#${clipId})` : undefined}>
        {TRIGRAMS_CLOCKWISE.map((t) => {
          const a0 = PALACES[t].bearing - 22.5 - northOffset
          const a1 = PALACES[t].bearing + 22.5 - northOffset
          const p0 = polar(center, R * 1.5, a0), p1 = polar(center, R * 1.5, a1)
          const i = info?.[t]
          return <path key={t} d={`M ${center.x} ${center.y} L ${p0.x} ${p0.y} A ${R * 1.5} ${R * 1.5} 0 0 1 ${p1.x} ${p1.y} Z`} fill={i?.tone ? toneColor[i.tone] : 'transparent'} stroke="var(--muted-foreground)" strokeOpacity={0.45} strokeDasharray="6 4" strokeWidth={fontSize / 10} />
        })}
      </g>
      {TRIGRAMS_CLOCKWISE.map((t) => {
        const i = info?.[t]
        const mid = anchors ? anchors[t] : polar(center, R * 0.72, PALACES[t].bearing - northOffset)
        const small = anchors ? anchors[t].n < 12 : false
        return (
          <g key={t}>
            <text x={mid.x} y={mid.y} textAnchor="middle" fontSize={small ? fontSize * 0.8 : fontSize} fill="var(--foreground)" fontWeight={500}>{small ? PALACES[t].direction : `${PALACES[t].zh}·${PALACES[t].direction}`}</text>
            {i?.lines.map((l, k) => <text key={k} x={mid.x} y={mid.y + fontSize * (1.15 + k * 1.05)} textAnchor="middle" fontSize={fontSize * 0.8} fill="var(--foreground)" opacity={0.75}>{l}</text>)}
          </g>
        )
      })}
      <circle cx={center.x} cy={center.y} r={R * 0.18} fill="color-mix(in oklch, var(--muted-foreground) 8%, transparent)" stroke="var(--muted-foreground)" strokeOpacity={0.45} strokeWidth={fontSize / 10} />
      <text x={center.x} y={center.y + fontSize * 0.35} textAnchor="middle" fontSize={fontSize} fill="var(--foreground)">中</text>
      {/* north arrow */}
      {(() => { const n = polar(center, R * 1.08, -northOffset); return <g><line x1={center.x} y1={center.y} x2={n.x} y2={n.y} stroke="var(--destructive)" strokeOpacity={0.6} strokeWidth={fontSize / 8} /><text x={n.x} y={n.y - fontSize * 0.4} textAnchor="middle" fontSize={fontSize} fill="var(--destructive)" fontWeight={500}>N</text></g> })()}
    </g>
  )
}

function polar(c: Point, r: number, deg: number): Point {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }
}
