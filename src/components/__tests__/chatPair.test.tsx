/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import ChatPair from '../ChatPair'
import type { ResponseItem } from '../../types'

describe('ChatPair', () => {
  it('renders user and assistant messages', () => {
    const user = { type: 'Message', role: 'user', content: 'hi' } as any
    const assistant = { type: 'Message', role: 'assistant', content: 'hello' } as any
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    root.render(<ChatPair user={user} assistant={assistant} />)
    expect(container.textContent).toContain('hi')
    expect(container.textContent).toContain('hello')
    root.unmount()
    document.body.removeChild(container)
  })
})

