import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { logError, logInfo } from './utils/logger'

const root = createRoot(document.getElementById('root')!)

// Global error hooks → watch-log server
window.addEventListener('error', (e) => {
  try { logError('window.onerror', e.error || e.message, { filename: (e as any).filename, lineno: (e as any).lineno, colno: (e as any).colno }) } catch {}
})
window.addEventListener('unhandledrejection', (e) => {
  try { logError('window.unhandledrejection', (e as any).reason || 'unhandledrejection') } catch {}
})
try { logInfo('app.start', 'App booting') } catch {}
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
