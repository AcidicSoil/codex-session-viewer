/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import DiffView, { LARGE_DIFF_THRESHOLD } from '../DiffView'

describe('DiffView edge cases', () => {
  it('shows binary warning', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(React.createElement(DiffView, { original: '\u0000', modified: '\u0000' }))
    const text = container.textContent || ''
    expect(text).toMatch(/Binary file/)
    root.unmount()
    document.body.removeChild(container)
  })

  it('shows large diff preview with download option', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const big = 'a'.repeat(LARGE_DIFF_THRESHOLD + 1)
    root.render(React.createElement(DiffView, { original: big, modified: big }))
    const text = container.textContent || ''
    expect(text).toMatch(/download full diff/i)
    root.unmount()
    document.body.removeChild(container)
  })
})
