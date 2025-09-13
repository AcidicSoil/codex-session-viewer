/* @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { Sparkles } from '../ui/sparkles'

describe('Sparkles', () => {
  it('respects prefers-reduced-motion', () => {
    const mm = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    // @ts-ignore
    window.matchMedia = mm
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(
      <Sparkles>
        <span>hello</span>
      </Sparkles>
    )
    expect(container.querySelector('[data-animate]')?.getAttribute('data-animate')).toBe('false')
    mm.mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    root.render(
      <Sparkles>
        <span>hello</span>
      </Sparkles>
    )
    expect(container.querySelector('[data-animate]')?.getAttribute('data-animate')).toBe('true')
  })
})
