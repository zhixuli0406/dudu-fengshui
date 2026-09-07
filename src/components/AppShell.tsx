import { useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, ChevronLeft, Compass, FileText, Home, LayoutGrid, MoreHorizontal, ShieldCheck, Trees, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './mds'

const NAV = [
  { to: '/', label: '看房', icon: Home, end: true },
  { to: '/report', label: '怎麼做', icon: FileText },
  { to: '/plan', label: '平面圖', icon: LayoutGrid },
] as const

const MORE = [
  { to: '/compass', label: '羅盤量向', desc: '站在大門內側量朝向', icon: Compass },
  { to: '/environment', label: '外局問卷', desc: '路沖、壁刀等屋外環境', icon: Trees },
  { to: '/knowledge', label: '知識庫', desc: '八宅、飛星、二十四山、規則庫', icon: BookOpen },
  { to: '/privacy', label: '隱私與免責', desc: '資料存放位置與使用限制', icon: ShieldCheck },
] as const

export function AppShell({ children }: { children: ReactNode }) {
  const [more, setMore] = useState(false)
  const loc = useLocation()
  return (
    <div className="flex min-h-full flex-col bg-app-shell">
      <main className="flex-1 pb-[calc(3.75rem+env(safe-area-inset-bottom))]">{children}</main>
      {loc.pathname !== '/' && !loc.pathname.startsWith('/story') && !loc.pathname.startsWith('/start') && <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-surface/95 backdrop-blur safe-b no-print">
        <ul className="mx-auto flex max-w-2xl">
          {NAV.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink to={t.to} end={'end' in t && t.end} className={({ isActive }) => cn('flex h-15 flex-col items-center justify-center gap-0.5 text-[11px]', isActive ? 'text-brand' : 'text-muted-foreground')}>
                <t.icon className="size-5" strokeWidth={1.75} />
                {t.label}
              </NavLink>
            </li>
          ))}
          <li className="flex-1">
            <button onClick={() => setMore(true)} className={cn('flex h-15 w-full flex-col items-center justify-center gap-0.5 text-[11px]', MORE.some((m) => loc.pathname.startsWith(m.to)) ? 'text-brand' : 'text-muted-foreground')}>
              <MoreHorizontal className="size-5" strokeWidth={1.75} />
              更多
            </button>
          </li>
        </ul>
      </nav>}
      {more && <MoreSheet onClose={() => setMore(false)} />}
    </div>
  )
}

function MoreSheet({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="更多功能">
      <button aria-label="關閉" className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="sheet-enter absolute inset-x-0 bottom-0 mx-auto max-w-2xl rounded-t-2xl bg-surface-raised p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[var(--floating-shadow)]">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium">更多</span>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="關閉"><X /></Button>
        </div>
        <ul className="divide-y divide-surface-border">
          {MORE.map((m) => (
            <li key={m.to}>
              <button onClick={() => { onClose(); nav(m.to) }} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-surface-hover">
                <m.icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="block text-xs text-muted-foreground">{m.desc}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Page header: h-12, optional back, title, right action. */
export function PageHeader({ title, back, right, subtitle }: { title: ReactNode; back?: string | true; right?: ReactNode; subtitle?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="sticky top-0 z-30 border-b border-surface-border bg-surface/95 backdrop-blur safe-t no-print">
      <div className="mx-auto flex h-12 max-w-2xl items-center gap-2 px-3">
        {back && <Button variant="ghost" size="icon-sm" aria-label="返回" onClick={() => (back === true ? nav(-1) : nav(back))}><ChevronLeft /></Button>}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-medium">{title}</h1>
          {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        {right}
      </div>
    </header>
  )
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-2xl px-4 py-4', className)}>{children}</div>
}
