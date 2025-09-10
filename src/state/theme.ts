import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Mode = 'light' | 'dark' | 'system'
type Theme = 'teal' | 'rose' | 'indigo'

interface ThemeState {
  theme: Theme
  mode: Mode
  setTheme: (t: Theme) => void
  setMode: (m: Mode) => void
}

const applyTheme = (theme: Theme) => {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
}

const applyMode = (mode: Mode) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const hasMM = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  const prefersDark = hasMM ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false }
  const isDark = mode === 'dark' || (mode === 'system' && !!prefersDark.matches)
  root.classList.toggle('dark', isDark)
  root.setAttribute('data-mode', isDark ? 'dark' : 'light')
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'teal',
      mode: 'system',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      setMode: (mode) => {
        applyMode(mode)
        set({ mode })
      }
    }),
    {
      name: 'csv:theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme)
          applyMode(state.mode)
        }
      }
    }
  )
)

// Apply initial state
if (typeof document !== 'undefined') {
  applyTheme(useTheme.getState().theme)
  applyMode(useTheme.getState().mode)
}

// React to system preference changes when in system mode
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', () => {
    const { mode } = useTheme.getState()
    if (mode === 'system') applyMode('system')
  })
}
