/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import FileTree from '../FileTree'
import DropZone from '../DropZone'

describe('Preline auto-init hooks', () => {
  beforeEach(() => {
    // Reset globals before each test
    // @ts-ignore
    window.HSTreeView = { autoInit: vi.fn() }
    // @ts-ignore
    window.HSFileUpload = { autoInit: vi.fn() }
  })

  it('calls HSTreeView.autoInit() after FileTree mounts', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(
      React.createElement(FileTree, {
        paths: ['src/a.ts', 'src/b.ts', 'README.md'],
        onSelect: () => {},
      })
    )
    // Let microtasks run
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    // @ts-ignore
    expect(window.HSTreeView.autoInit).toHaveBeenCalled()
    root.unmount()
    document.body.removeChild(container)
  })

  it('calls HSFileUpload.autoInit() after DropZone mounts', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const onFile = () => {}
    root.render(React.createElement(DropZone, { onFile }))
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    // @ts-ignore
    expect(window.HSFileUpload.autoInit).toHaveBeenCalled()
    root.unmount()
    document.body.removeChild(container)
  })
})

