/* @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import * as React from 'react'
import FileDiffHistory from '../FileDiffHistory'

describe('FileDiffHistory accordion', () => {
  it('auto inits Preline accordion on mount', async () => {
    // @ts-ignore
    window.HSAccordion = { autoInit: vi.fn() }
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(
      React.createElement(FileDiffHistory, {
        filePath: 'a.txt',
        diffs: [
          { diff: 'one', at: 't1' },
          { diff: 'two', at: 't2' },
        ],
      })
    )
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    // @ts-ignore
    expect(window.HSAccordion.autoInit).toHaveBeenCalled()
    root.unmount()
    document.body.removeChild(container)
  })
})

