import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** Label above control, helper below. Error text replaces helper. */
export function Field({ label, children, hint, error, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; error?: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? <span className="text-xs text-destructive">{error}</span> : hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
}
