import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { initVariantLaunch, isIOS, VARIANT_LAUNCH_KEY } from './ar/providers'

if (isIOS() && VARIANT_LAUNCH_KEY) void initVariantLaunch()

// Theme: one dark look everywhere, so the tools match the master's walk-through.
document.documentElement.classList.add('dark')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
