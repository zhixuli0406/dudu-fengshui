import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { initVariantLaunch, isIOS, VARIANT_LAUNCH_KEY } from './ar/providers'

if (isIOS() && VARIANT_LAUNCH_KEY) void initVariantLaunch()

// Theme: follow the system; MDS tokens switch on the `.dark` class.
const mq = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = () => document.documentElement.classList.toggle('dark', mq.matches)
applyTheme()
mq.addEventListener('change', applyTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
