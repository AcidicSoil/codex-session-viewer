import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Mode = 'light' | 'dark' | 'system'
type Theme = 'teal' | 'rose' | 'indigo' | 'custom'

interface ThemeState {
  theme: Theme
  mode: Mode
  setTheme: (t: Theme) => void
  setMode: (m: Mode) => void
  // When set, overrides --primary regardless of `theme`
  customPrimary: string | null
  setCustomPrimary: (hex: string | null) => void
  // When set, overrides --background and adjusts --foreground
  customBackground: string | null
  setCustomBackground: (hex: string | null) => void
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
      customPrimary: null,
      customBackground: null,
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      setMode: (mode) => {
        applyMode(mode)
        set({ mode })
      },
      setCustomPrimary: (hex) => {
        applyCustomPrimary(hex)
        set({ customPrimary: hex, theme: hex ? 'custom' : useTheme.getState().theme })
      },
      setCustomBackground: (hex) => {
        applyCustomBackground(hex)
        set({ customBackground: hex })
      }
    }),
    {
      name: 'csv:theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme)
          applyMode(state.mode)
          applyCustomPrimary(state.customPrimary ?? null)
          applyCustomBackground(state.customBackground ?? null)
        }
      }
    }
  )
)

// Apply initial state
if (typeof document !== 'undefined') {
  applyTheme(useTheme.getState().theme)
  applyMode(useTheme.getState().mode)
  applyCustomPrimary(useTheme.getState().customPrimary)
  applyCustomBackground(useTheme.getState().customBackground)
}

// React to system preference changes when in system mode
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', () => {
    const { mode } = useTheme.getState()
    if (mode === 'system') applyMode('system')
  })
}

function applyCustomPrimary(hex: string | null | undefined) {
  if (typeof document === 'undefined') return
  const root = document.documentElement as HTMLElement
  if (!hex) {
    root.style.removeProperty('--primary')
    root.style.removeProperty('--primary-foreground')
    return
  }
  const rgb = hexToRgb(hex)
  if (rgb) {
    const value = `${rgb.r} ${rgb.g} ${rgb.b}`
    root.style.setProperty('--primary', value)
    // Choose foreground based on luminance for contrast
    const lum = relativeLuminance(rgb)
    const fg = lum > 0.5 ? '0 0 0' : '255 255 255'
    root.style.setProperty('--primary-foreground', fg)
  }
}

function applyCustomBackground(hex: string | null | undefined) {
  if (typeof document === 'undefined') return
  const root = document.documentElement as HTMLElement
  if (!hex) {
    root.style.removeProperty('--background')
    root.style.removeProperty('--foreground')
    return
  }
  const rgb = hexToRgb(hex)
  if (rgb) {
    const value = `${rgb.r} ${rgb.g} ${rgb.b}`
    root.style.setProperty('--background', value)
    const lum = relativeLuminance(rgb)
    const fg = lum > 0.5 ? '0 0 0' : '255 255 255'
    root.style.setProperty('--foreground', fg)
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().toLowerCase().match(/^#?([a-f0-9]{6})$/i)
  if (!m) return null
  const n = parseInt(m[1]!, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const toLin = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const R = toLin(r), G = toLin(g), B = toLin(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}
