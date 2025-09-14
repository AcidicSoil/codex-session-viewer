/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import TwoFileDiff from '../TwoFileDiff'

describe('TwoFileDiff', () => {
  it('renders drop zone and instructions (SSR)', () => {
    const html = renderToString(React.createElement(TwoFileDiff))
    expect(html).toContain('Drop one or two')
  })

  it('loads files when dropped', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(React.createElement(TwoFileDiff))
    await Promise.resolve()
    const dz = container.querySelector('[data-testid="twofile-drop"]') as HTMLElement
    const dt = new DataTransfer()
    dt.items.add(new File(['hello'], 'a.txt', { type: 'text/plain' }))
    dt.items.add(new File(['world'], 'b.txt', { type: 'text/plain' }))
    dz.dispatchEvent(new DragEvent('drop', { dataTransfer: dt }))
    await new Promise((r) => setTimeout(r, 0))
    expect(dz.textContent).toContain('File A: a.txt')
    expect(dz.textContent).toContain('File B: b.txt')
    root.unmount()
    document.body.removeChild(container)
  })

  it('shows error on duplicate files', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(React.createElement(TwoFileDiff))
    await Promise.resolve()
    const dz = container.querySelector('[data-testid="twofile-drop"]') as HTMLElement
    const dt = new DataTransfer()
    dt.items.add(new File(['same'], 'dup.txt', { type: 'text/plain' }))
    dt.items.add(new File(['same'], 'dup.txt', { type: 'text/plain' }))
    dz.dispatchEvent(new DragEvent('drop', { dataTransfer: dt }))
    await new Promise((r) => setTimeout(r, 0))
    const error = container.querySelector('.text-red-600') as HTMLElement
    expect(error.textContent).toMatch(/duplicate files/i)
    root.unmount()
    document.body.removeChild(container)
  })
})
