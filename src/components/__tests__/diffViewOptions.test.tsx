/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import DiffView from '../DiffView'

describe('DiffViewer options (UI smoke)', () => {
  it('renders header controls (wrap and split toggles)', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(React.createElement(DiffView, { path: 'a.txt', original: 'a', modified: 'b' }))
    // Controls exist in header even when Monaco lazy import is pending
    const text = container.textContent || ''
    expect(text).toMatch(/Wrap|No wrap/)
    expect(text).toMatch(/Split|Inline/)
    root.unmount()
    document.body.removeChild(container)
  })
})

