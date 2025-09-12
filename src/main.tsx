import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import '@preline/accordion'
import '@preline/tree-view'
import '@preline/file-upload'
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

// Simple manual test hook to confirm logging pipeline in the browser console:
// In DevTools run: window.csvTestError()
;(window as any).csvTestError = () => {
  try {
    throw new Error('CSV test error (manual)')
  } catch (e) {
    try { logError('manual.test', e) } catch {}
    // Re-throw to also trigger window.onerror path
    setTimeout(() => { throw e }, 0)
  }
}
