import { describe, it, expect } from 'vitest'
import { computeMonacoTheme } from '../DiffViewer'

describe('computeMonacoTheme', () => {
  it('respects explicit overrides', () => {
    expect(computeMonacoTheme('light', 'dark', 'light')).toBe('vs-dark')
    expect(computeMonacoTheme('dark', 'light', 'dark')).toBe('vs')
  })
  it('auto maps to app mode', () => {
    expect(computeMonacoTheme('light', 'auto', 'dark')).toBe('vs')
    expect(computeMonacoTheme('dark', 'auto', 'light')).toBe('vs-dark')
  })
  it('system uses data-mode', () => {
    expect(computeMonacoTheme('system', 'auto', 'dark')).toBe('vs-dark')
    expect(computeMonacoTheme('system', 'auto', 'light')).toBe('vs')
    // SSR fallback: when data-mode is unavailable, default to light
    expect(computeMonacoTheme('system', 'auto', null as any)).toBe('vs')
  })
})
