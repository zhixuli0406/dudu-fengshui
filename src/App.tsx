import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ConsentGate } from './components/ConsentGate'
import { HomePage } from './pages/HomePage'
import { SetupPage } from './pages/SetupPage'
import { CompassPage } from './pages/CompassPage'
import { PlanPage } from './pages/PlanPage'
import { PlanWizardPage } from './pages/PlanWizardPage'
import { ScanPage } from './pages/ScanPage'
import { ReportPage } from './pages/ReportPage'
import { EnvironmentPage } from './pages/EnvironmentPage'
import { PrivacyPage } from './pages/PrivacyPage'

const KnowledgePage = lazy(() => import('./pages/KnowledgePage').then((m) => ({ default: m.KnowledgePage })))

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/compass" element={<CompassPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/plan/wizard" element={<PlanWizardPage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/environment" element={<EnvironmentPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/knowledge" element={<Suspense fallback={<div className="p-6 text-sm text-muted-foreground">載入知識庫…</div>}><KnowledgePage /></Suspense>} />
      </Routes>
      <ConsentGate />
    </AppShell>
  )
}
