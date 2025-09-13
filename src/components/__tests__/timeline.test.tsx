/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import Timeline from '../Timeline'
import { BookmarksProvider } from '../../state/bookmarks'
import { usePreferences } from '../../state/preferences'
import type { ResponseItem } from '../../types'

describe('Timeline chat mode', () => {
  it('groups user and assistant messages into ChatPair', async () => {
    const events = [
      { ev: { type: 'Message', role: 'user', content: 'hi' } as ResponseItem, key: 'u1', absIndex: 0 },
      { ev: { type: 'Message', role: 'assistant', content: 'hello' } as ResponseItem, key: 'a1', absIndex: 1 },
    ] as const
    usePreferences.getState().setChatMode(true)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(
      <BookmarksProvider>
        <Timeline items={events} />
      </BookmarksProvider>
    )
    await Promise.resolve()
    expect(container.querySelectorAll('[data-testid="chat-pair"]').length).toBe(1)
    root.unmount()
    document.body.removeChild(container)
    usePreferences.getState().setChatMode(false)
  })
})

