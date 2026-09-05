import type { ComponentType, ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function Empty({ icon: Icon, title, description, action, tone = 'default', variant = 'default', className }: {
  icon?: ComponentType<{ className?: string }>; title: ReactNode; description?: ReactNode; action?: ReactNode
  tone?: 'default' | 'destructive'; variant?: 'default' | 'dashed'; className?: string
}) {
  const destructive = tone === 'destructive'
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', variant === 'dashed' ? 'rounded-lg border border-dashed border-border py-10' : 'py-12', className)}>
      {Icon && (
        <div className={cn('mb-3 flex size-11 items-center justify-center rounded-full', destructive ? 'bg-destructive/10' : 'bg-muted')}>
          <Icon className={cn('size-5', destructive ? 'text-destructive' : 'text-muted-foreground/60')} />
        </div>
      )}
      <p className={cn('text-sm font-medium', destructive ? 'text-destructive' : 'text-foreground')}>{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
