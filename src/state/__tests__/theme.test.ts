/* @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from 'vitest'
import { useTheme } from '../theme'

beforeAll(() => {
  // jsdom missing matchMedia; provide a simple mock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
})

describe('theme store', () => {
  it('applies initial theme and mode to document', () => {
    const root = document.documentElement
    expect(root.getAttribute('data-theme')).toBeDefined()
    expect(root.getAttribute('data-mode')).toMatch(/light|dark/)
  })

  it('toggles dark mode class', () => {
    const root = document.documentElement
    useTheme.getState().setMode('dark')
    expect(root.classList.contains('dark')).toBe(true)
    useTheme.getState().setMode('light')
    expect(root.classList.contains('dark')).toBe(false)
  })

  it('applies custom background and foreground', () => {
    const root = document.documentElement
    useTheme.getState().setCustomBackground('#ff0000')
    expect(root.style.getPropertyValue('--background').trim()).toBe('255 0 0')
    expect(root.style.getPropertyValue('--foreground').trim()).toBe('255 255 255')
    useTheme.getState().setCustomBackground(null)
  })
})

