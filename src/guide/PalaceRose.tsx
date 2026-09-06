import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from '../engine/bagua'

export type RoseTone = 'good' | 'info' | 'muted' | 'bad'
const FILL: Record<RoseTone, string> = { good: 'color-mix(in oklch, var(--brand) 45%, transparent)', info: 'rgba(56, 189, 248, 0.35)', muted: 'rgba(255,255,255,0.12)', bad: 'rgba(244, 63, 94, 0.35)' }
const TEXT: Record<RoseTone, string> = { good: 'var(--brand)', info: '#bae6fd', muted: '#d4d4d8', bad: '#fecdd3' }

/**
 * Compass rose with the eight directions as sectors (north up), tagged with what sits there
 * (財位／文昌／洩財). Deliberately a circle, not a grid, so nobody reads it as a floor plan.
 */
export function PalaceRose({ cells, door, size = 224 }: { cells: Partial<Record<Trigram, { label: string; tone: RoseTone }>>; door?: Trigram; size?: number }) {
  const r = size / 2
  const R = r - 6
  const pt = (deg: number, rad: number) => { const a = ((deg - 90) * Math.PI) / 180; return { x: r + rad * Math.cos(a), y: r + rad * Math.sin(a) } }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="八方位" className="mx-auto block">
      <circle cx={r} cy={r} r={R} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.25)" />
      {TRIGRAMS_CLOCKWISE.map((t) => {
        const b = PALACES[t].bearing
        const a0 = pt(b - 22.5, R), a1 = pt(b + 22.5, R)
        const c = cells[t]
        const lab = pt(b, R * 0.7)
        return (
          <g key={t}>
            <path d={`M ${r} ${r} L ${a0.x} ${a0.y} A ${R} ${R} 0 0 1 ${a1.x} ${a1.y} Z`} fill={c ? FILL[c.tone] : 'transparent'} stroke="rgba(255,255,255,0.15)" />
            <text x={lab.x} y={lab.y - (c ? 4 : -4)} textAnchor="middle" fontSize={13} fontWeight={500} fill={c ? TEXT[c.tone] : 'rgba(255,255,255,0.6)'}>{PALACES[t].direction}</text>
            {c && <text x={lab.x} y={lab.y + 11} textAnchor="middle" fontSize={10} fill={TEXT[c.tone]}>{c.label}</text>}
          </g>
        )
      })}
      <circle cx={r} cy={r} r={R * 0.28} fill="#0c0d10" stroke="rgba(255,255,255,0.2)" />
      <text x={r} y={r + 4} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.6)">上方為北</text>
      {door && (() => { const p = pt(PALACES[door].bearing, R - 2); return <g><circle cx={p.x} cy={p.y} r={9} fill="#efe7d6" /><text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize={9} fill="#0c0d10">門</text></g> })()}
    </svg>
  )
}
