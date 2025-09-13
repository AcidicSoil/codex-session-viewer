/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import CollapsibleCard from '../ui/collapsible-card'
import MetadataPanel from '../MetadataPanel'

describe('MetadataPanel within CollapsibleCard', () => {
  it('renders metadata within a collapsible card', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const meta: any = { id: '1', timestamp: 'now' }
      root.render(
        React.createElement(CollapsibleCard, {
          title: 'Metadata',
          children: React.createElement(MetadataPanel, { meta }),
        })
      )
    await new Promise((r) => setTimeout(r, 0))
    const trigger = container.querySelector('button')
    expect(trigger).not.toBeNull()
    expect(container.textContent).toMatch(/Session Metadata/)
    root.unmount()
    document.body.removeChild(container)
  })
})
