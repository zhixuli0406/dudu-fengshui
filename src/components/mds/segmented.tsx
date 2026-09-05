import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type SegmentedOption<T extends string> = { value: T; label: ReactNode; disabled?: boolean }

/** Segmented control, options-driven and controlled. */
export function Segmented<T extends string>({ value, onValueChange, options, className, size = 'default', 'aria-label': ariaLabel }: {
  value: T; onValueChange: (v: T) => void; options: readonly SegmentedOption<T>[]; className?: string; size?: 'default' | 'lg'; 'aria-label'?: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex gap-0.5 rounded-md bg-muted p-0.5', className)}>
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button key={opt.value} type="button" role="radio" aria-checked={selected} disabled={opt.disabled} onClick={() => onValueChange(opt.value)}
            className={cn('flex-1 rounded-sm px-2.5 text-xs font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
              size === 'lg' ? 'py-2 text-sm' : 'py-1',
              selected ? 'bg-surface text-foreground shadow-sm' : 'hover:text-foreground')}>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
