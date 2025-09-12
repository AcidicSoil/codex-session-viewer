import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import TwoFileDiff from '../TwoFileDiff'

describe('TwoFileDiff (SSR smoke)', () => {
  it('renders file inputs and header', () => {
    const html = renderToString(React.createElement(TwoFileDiff))
    expect(html).toContain('File A')
    expect(html).toContain('File B')
  })
})

