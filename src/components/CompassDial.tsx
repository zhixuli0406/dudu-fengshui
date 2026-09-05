import { MOUNTAINS } from '../engine/mountains24'
import { PALACES, TRIGRAMS_CLOCKWISE } from '../engine/bagua'

interface Props {
  /** bearing that the top of the screen points to; dial rotates by −heading */
  heading: number | null
  size?: number
  /** highlight a bearing (e.g., locked facing) */
  marker?: number | null
  className?: string
}

/** 羅盤 — outer ring 360°, 24 山 ring, 八卦 ring; rotates so that north stays at compass north. */
export function CompassDial({ heading, size = 320, marker, className }: Props) {
  const r = size / 2
  const rot = heading == null ? 0 : -heading
  const ringOuter = r - 6
  const ringMountain = r - 40
  const ringTrigram = r - 80
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label="羅盤">
      <defs>
        <radialGradient id="dialBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--surface)" />
          <stop offset="100%" stopColor="var(--surface-hover)" />
        </radialGradient>
      </defs>
      <circle cx={r} cy={r} r={ringOuter + 4} fill="url(#dialBg)" stroke="var(--surface-border)" strokeWidth={2} />
      <g transform={`rotate(${rot} ${r} ${r})`}>
        {/* degree ticks */}
        {Array.from({ length: 72 }, (_, i) => {
          const a = i * 5
          const major = a % 15 === 0
          const len = a % 90 === 0 ? 14 : major ? 9 : 5
          return <line key={a} x1={r} y1={r - ringOuter} x2={r} y2={r - ringOuter + len} stroke={a % 90 === 0 ? 'var(--foreground)' : 'var(--muted-foreground)'} strokeWidth={major ? 1.5 : 0.8} transform={`rotate(${a} ${r} ${r})`} />
        })}
        {[0, 90, 180, 270].map((a) => (
          <text key={a} x={r} y={r - ringOuter + 26} textAnchor="middle" fontSize={13} fill="var(--foreground)" fontWeight={500} transform={`rotate(${a} ${r} ${r})`}>{a === 0 ? '北' : a === 90 ? '東' : a === 180 ? '南' : '西'}</text>
        ))}
        {/* 24 mountains */}
        <circle cx={r} cy={r} r={ringMountain} fill="none" stroke="var(--surface-border)" strokeWidth={1} />
        {MOUNTAINS.map((m) => (
          <g key={m.name} transform={`rotate(${m.center} ${r} ${r})`}>
            <line x1={r} y1={r - ringMountain} x2={r} y2={r - ringMountain - 12} stroke="var(--surface-border)" strokeWidth={0.8} transform={`rotate(7.5 ${r} ${r})`} />
            <text x={r} y={r - ringMountain + 16} textAnchor="middle" fontSize={12} fill={m.yang ? 'var(--foreground)' : 'var(--brand)'}>{m.name}</text>
          </g>
        ))}
        {/* 八卦 */}
        <circle cx={r} cy={r} r={ringTrigram} fill="none" stroke="var(--surface-border)" strokeWidth={1} />
        {TRIGRAMS_CLOCKWISE.map((t) => {
          const p = PALACES[t]
          return (
            <g key={t} transform={`rotate(${p.bearing} ${r} ${r})`}>
              <line x1={r} y1={r - ringTrigram} x2={r} y2={r - ringMountain} stroke="var(--surface-border)" strokeWidth={0.8} transform={`rotate(22.5 ${r} ${r})`} />
              <text x={r} y={r - ringTrigram + 18} textAnchor="middle" fontSize={15} fill="var(--foreground)" fontWeight={500}>{p.zh}</text>
              <text x={r} y={r - ringTrigram + 32} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">{p.luoshu}</text>
            </g>
          )
        })}
        {/* north needle */}
        <polygon points={`${r},${r - ringTrigram + 40} ${r - 6},${r} ${r + 6},${r}`} fill="var(--destructive)" />
        <polygon points={`${r},${r + ringTrigram - 40} ${r - 6},${r} ${r + 6},${r}`} fill="var(--muted-foreground)" opacity={0.7} />
        {typeof marker === 'number' && (
          <g transform={`rotate(${marker} ${r} ${r})`}>
            <line x1={r} y1={r} x2={r} y2={r - ringOuter} stroke="var(--brand)" strokeWidth={3} strokeDasharray="6 4" />
          </g>
        )}
      </g>
      {/* fixed top pointer (device heading) */}
      <polygon points={`${r},${8} ${r - 8},${26} ${r + 8},${26}`} fill="var(--brand)" />
      <circle cx={r} cy={r} r={6} fill="var(--foreground)" />
    </svg>
  )
}
