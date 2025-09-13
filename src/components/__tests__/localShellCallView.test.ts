import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import EventCard from '../EventCard'
import { BookmarksProvider } from '../../state/bookmarks'

describe('LocalShellCallView (apply_patch)', () => {
  it('renders diff from apply_patch command', () => {
    const patch = [
      '*** Begin Patch',
      '*** Update File: a.txt',
      '@@',
      '-foo',
      '+bar',
      '*** End Patch',
      '',
    ].join('\n')
    const command = `apply_patch <<'PATCH'\n${patch}\nPATCH`
    const item = { type: 'LocalShellCall', command } as any
    const html = renderToString(
      React.createElement(BookmarksProvider, null, React.createElement(EventCard, { item }))
    )
    expect(html).toContain('a.txt')
    expect(html).toContain('apply_patch')
  })
})
