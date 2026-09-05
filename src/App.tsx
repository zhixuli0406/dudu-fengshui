import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { SetupPage } from './pages/SetupPage'
import { CompassPage } from './pages/CompassPage'
import { PlanPage } from './pages/PlanPage'
import { ScanPage } from './pages/ScanPage'
import { ReportPage } from './pages/ReportPage'
const KnowledgePage = lazy(() => import('./pages/KnowledgePage').then((m) => ({ default: m.KnowledgePage })))
import { EnvironmentPage } from './pages/EnvironmentPage'

const tabs = [
  { to: '/', label: '首頁', icon: '☯' },
  { to: '/setup', label: '資料', icon: '👤' },
  { to: '/compass', label: '羅盤', icon: '🧭' },
  { to: '/plan', label: '平面圖', icon: '📐' },
  { to: '/report', label: '報告', icon: '📜' },
]

export default function App() {
  return (
    <div className="min-h-full flex flex-col bg-ink text-paper">
      <main className="flex-1 pb-20">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/compass" element={<CompassPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/knowledge" element={<Suspense fallback={<div className="p-6 text-paper/60">載入知識庫…</div>}><KnowledgePage /></Suspense>} />
          <Route path="/environment" element={<EnvironmentPage />} />
        </Routes>
      </main>
      <nav className="fixed bottom-0 inset-x-0 bg-ink-2/95 backdrop-blur border-t border-ink-3 safe-b z-40">
        <ul className="flex justify-around">
          {tabs.map((t) => (
            <li key={t.to} className="flex-1">
              <NavLink to={t.to} end={t.to === '/'} className={({ isActive }) => `flex flex-col items-center py-2 text-[11px] ${isActive ? 'text-gold' : 'text-paper/60'}`}>
                <span className="text-lg leading-none mb-0.5">{t.icon}</span>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
