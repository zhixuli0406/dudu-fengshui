import type { ReactNode } from 'react'
import { PALACES, type Trigram } from '../engine/bagua'
import { cn } from '../lib/utils'

const GRID: (Trigram | 'center')[][] = [['qian', 'kan', 'gen'], ['dui', 'center', 'zhen'], ['kun', 'li', 'xun']]

/** 3×3 compass-style picker (north up). `center` renders in the middle cell. */
export function DirectionPad({ value, onChange, center, size = 'lg', className, dim }: { value?: Trigram | null; onChange: (t: Trigram) => void; center?: ReactNode; size?: 'lg' | 'sm'; className?: string; dim?: Trigram[] }) {
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)} role="radiogroup" aria-label="方位">
      {GRID.flat().map((t) => t === 'center' ? (
        <div key="c" className="flex items-center justify-center">{center}</div>
      ) : (
        <button key={t} type="button" role="radio" aria-checked={value === t} onClick={() => onChange(t)}
          className={cn('rounded-xl border text-center font-medium transition-colors active:translate-y-px', size === 'lg' ? 'h-14 text-base' : 'h-10 text-sm',
            value === t ? 'border-brand bg-brand text-brand-foreground' : 'border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10', dim?.includes(t) && value !== t && 'opacity-40')}>
          {PALACES[t].direction}
        </button>
      ))}
    </div>
  )
}
