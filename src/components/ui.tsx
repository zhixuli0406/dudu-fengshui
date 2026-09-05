import type { ReactNode } from 'react'

export function Card({ title, children, className = '', right }: { title?: ReactNode; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`rounded-2xl bg-ink-2 border border-ink-3/60 p-4 ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between mb-3">
          {title && <h2 className="font-serif text-gold text-lg font-bold">{title}</h2>}
          {right}
        </header>
      )}
      {children}
    </section>
  )
}

export function Button({ children, onClick, variant = 'primary', disabled, className = '', type = 'button' }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'subtle'; disabled?: boolean; className?: string; type?: 'button' | 'submit' }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none'
  const v = {
    primary: 'bg-gold text-ink hover:bg-gold-2',
    ghost: 'border border-gold/60 text-gold hover:bg-gold/10',
    danger: 'bg-cinnabar text-paper hover:brightness-110',
    subtle: 'bg-ink-3 text-paper hover:bg-ink-3/70',
  }[variant]
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${v} ${className}`}>{children}</button>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs text-paper/70 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-paper/50 mt-1">{hint}</span>}
    </label>
  )
}

export const inputCls = 'w-full rounded-lg bg-ink border border-ink-3 px-3 py-2 text-paper focus:outline-none focus:border-gold'

export function Badge({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'red' | 'green' | 'gray' | 'blue' }) {
  const c = { gold: 'bg-gold/15 text-gold', red: 'bg-cinnabar/20 text-red-300', green: 'bg-jade/20 text-emerald-300', gray: 'bg-ink-3 text-paper/70', blue: 'bg-water/20 text-blue-300' }[tone]
  return <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${c}`}>{children}</span>
}

export function ScoreRing({ score, label, size = 84 }: { score: number; label: string; size?: number }) {
  const r = size / 2 - 6
  const c = 2 * Math.PI * r
  const color = score >= 75 ? '#2e8b6a' : score >= 50 ? '#d6b35c' : '#c0392b'
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#44403c" strokeWidth={6} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fontSize={size / 4} fontWeight={700} fill="#f5f0e6">{score}</text>
      </svg>
      <span className="text-xs text-paper/70">{label}</span>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-ink-3 p-6 text-center text-sm text-paper/60">{children}</div>
}
