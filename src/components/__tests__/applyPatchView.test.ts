import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { renderToString } from 'react-dom/server'
import ApplyPatchView from '../ApplyPatchView'

function makeEventWithPatch(patch: string) {
  return {
    type: 'FunctionCall',
    name: 'shell',
    args: JSON.stringify({ command: ['apply_patch', patch] }),
  } as any
}

describe('ApplyPatchView (SSR snapshot)', () => {
  it('renders header and raw toggle for a simple update patch', () => {
    const patch = [
      '*** Begin Patch',
      '*** Update File: a.txt',
      '@@',
      '-foo',
      '+bar',
      '*** End Patch',
      '',
    ].join('\n')
    const item = makeEventWithPatch(patch)
    const html = renderToString(React.createElement(ApplyPatchView, { item }))
    expect(html).toContain('apply_patch')
    expect(html).toContain('Download raw')
    // should include file name button or label
    expect(html).toContain('a.txt')
  })
})

