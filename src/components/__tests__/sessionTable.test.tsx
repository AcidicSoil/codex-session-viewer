/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import SessionTable from '../SessionTable'
import { listSessions } from '../../db/sessions'

vi.mock('../../db/sessions', () => ({
  listSessions: vi.fn(),
}))

describe('SessionTable', () => {
  beforeEach(() => {
    vi.mocked(listSessions).mockResolvedValue([
      { id: 's1', events: [], createdAt: 0, updatedAt: 1 },
    ])
    // @ts-ignore
    window.HSDatatable = { autoInit: vi.fn() }
  })

  it('initializes Preline and opens session on row click', async () => {
    const loader = { loadSession: vi.fn() } as any
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(React.createElement(SessionTable, { loader }))
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    const row = container.querySelector('tbody tr')!
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(loader.loadSession).toHaveBeenCalledWith('s1')
    // @ts-ignore
    expect(window.HSDatatable.autoInit).toHaveBeenCalled()
    root.unmount()
    document.body.removeChild(container)
  })
})
