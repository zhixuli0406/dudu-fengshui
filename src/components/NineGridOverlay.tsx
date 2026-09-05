import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from '../engine/bagua'
import type { Point } from '../engine/geometry'

export interface PalaceOverlayInfo {
  /** up to 3 short lines drawn in the sector */
  lines: string[]
  tone?: 'good' | 'bad' | 'neutral'
}

interface Props {
  center: Point
  radius: number
  northOffset: number
  style: 'pie' | 'grid'
  bounds?: { minX: number; minY: number; maxX: number; maxY: number }
  info?: Partial<Record<Trigram, PalaceOverlayInfo>>
  fontSize: number
}

const toneColor = { good: 'rgba(46,139,106,0.18)', bad: 'rgba(192,57,43,0.20)', neutral: 'rgba(214,179,92,0.08)' }

/** 8 palace sectors (or a 3×3 grid) drawn around the plan centre, rotated by northOffset. */
export function NineGridOverlay({ center, radius, northOffset, style, bounds, info, fontSize }: Props) {
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
              <rect x={x} y={y} width={w / 3} height={h / 3} fill={i?.tone ? toneColor[i.tone] : 'transparent'} stroke="#d6b35c" strokeOpacity={0.5} strokeDasharray="6 4" strokeWidth={fontSize / 10} />
              <text x={x + w / 6} y={y + fontSize * 1.2} textAnchor="middle" fontSize={fontSize} fill="#d6b35c" fontFamily="var(--font-serif)" transform={`rotate(${northOffset} ${x + w / 6} ${y + fontSize * 1.2})`}>{t === 'center' ? '中' : `${PALACES[t].zh}·${PALACES[t].direction}`}</text>
              {i?.lines.map((l, k) => <text key={k} x={x + w / 6} y={y + fontSize * (2.4 + k * 1.1)} textAnchor="middle" fontSize={fontSize * 0.8} fill="#f5f0e6" opacity={0.85} transform={`rotate(${northOffset} ${x + w / 6} ${y + fontSize * (2.4 + k * 1.1)})`}>{l}</text>)}
            </g>
          )
        })}
      </g>
    )
  }
  const R = radius
  return (
    <g pointerEvents="none">
      {TRIGRAMS_CLOCKWISE.map((t) => {
        const a0 = PALACES[t].bearing - 22.5 - northOffset
        const a1 = PALACES[t].bearing + 22.5 - northOffset
        const p0 = polar(center, R, a0), p1 = polar(center, R, a1)
        const i = info?.[t]
        const mid = polar(center, R * 0.72, (a0 + a1) / 2)
        return (
          <g key={t}>
            <path d={`M ${center.x} ${center.y} L ${p0.x} ${p0.y} A ${R} ${R} 0 0 1 ${p1.x} ${p1.y} Z`} fill={i?.tone ? toneColor[i.tone] : 'transparent'} stroke="#d6b35c" strokeOpacity={0.45} strokeDasharray="6 4" strokeWidth={fontSize / 10} />
            <text x={mid.x} y={mid.y} textAnchor="middle" fontSize={fontSize} fill="#d6b35c" fontFamily="var(--font-serif)" fontWeight={700}>{PALACES[t].zh}·{PALACES[t].direction}</text>
            {i?.lines.map((l, k) => <text key={k} x={mid.x} y={mid.y + fontSize * (1.15 + k * 1.05)} textAnchor="middle" fontSize={fontSize * 0.8} fill="#f5f0e6" opacity={0.85}>{l}</text>)}
          </g>
        )
      })}
      <circle cx={center.x} cy={center.y} r={R * 0.18} fill="rgba(214,179,92,0.08)" stroke="#d6b35c" strokeOpacity={0.45} strokeWidth={fontSize / 10} />
      <text x={center.x} y={center.y + fontSize * 0.35} textAnchor="middle" fontSize={fontSize} fill="#d6b35c" fontFamily="var(--font-serif)">中</text>
      {/* north arrow */}
      {(() => { const n = polar(center, R * 1.08, -northOffset); return <g><line x1={center.x} y1={center.y} x2={n.x} y2={n.y} stroke="#c0392b" strokeOpacity={0.6} strokeWidth={fontSize / 8} /><text x={n.x} y={n.y - fontSize * 0.4} textAnchor="middle" fontSize={fontSize} fill="#c0392b" fontWeight={700}>N</text></g> })()}
    </g>
  )
}

function polar(c: Point, r: number, deg: number): Point {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }
}
