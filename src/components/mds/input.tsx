import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const fieldCls =
  'h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 text-base outline-none md:h-9 md:text-sm ' +
  'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, type = 'text', ...props }, ref) => (
  <input ref={ref} type={type} className={cn(fieldCls, className)} {...props} />
))
Input.displayName = 'Input'

/** Native select styled like Input (no base-ui dependency). */
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(fieldCls, 'appearance-none bg-surface pr-8 bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2371717a%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27><path d=%27m6 9 6 6 6-6%27/></svg>")] bg-no-repeat bg-[right_0.6rem_center]', className)} {...props} />
))
NativeSelect.displayName = 'NativeSelect'
