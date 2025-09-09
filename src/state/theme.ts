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
  document.documentElement.setAttribute('data-theme', theme)
}

const applyMode = (mode: Mode) => {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark.matches)
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
applyTheme(useTheme.getState().theme)
applyMode(useTheme.getState().mode)

// React to system preference changes when in system mode
const media = window.matchMedia('(prefers-color-scheme: dark)')
media.addEventListener('change', () => {
  const { mode } = useTheme.getState()
  if (mode === 'system') applyMode('system')
})
