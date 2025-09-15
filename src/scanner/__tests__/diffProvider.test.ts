import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('../../utils/fs-io', () => ({
  readFileText: vi.fn(),
}))

import { getWorkspaceDiff } from '../diffProvider'
import { readFileText } from '../../utils/fs-io'

describe('getWorkspaceDiff', () => {
  afterEach(() => vi.resetAllMocks())

  it('uses last FileChange diff for baseline', async () => {
    ;(readFileText as any).mockResolvedValue('modified content')
    const diff = [
      '--- a.txt',
      '+++ a.txt',
      '@@ -1,1 +1,1 @@',
      '-old content',
      '+modified content',
    ].join('\n')
    const events = [{ type: 'FileChange', path: 'a.txt', diff }]
    const result = await getWorkspaceDiff({} as any, 'a.txt', events)
    expect(result.original).toBe('old content')
    expect(result.modified).toBe('modified content')
  })

  it('falls back to apply_patch events when no FileChange diff', async () => {
    ;(readFileText as any).mockResolvedValue('new content')
    const patch = [
      '*** Begin Patch',
      '*** Update File: a.txt',
      '@@',
      '-old content',
      '+new content',
      '*** End Patch',
    ].join('\n')
    const events = [
      { type: 'FunctionCall', name: 'shell', args: JSON.stringify({ command: ['apply_patch', patch] }) },
    ]
    const result = await getWorkspaceDiff({} as any, 'a.txt', events)
    expect(result.original).toBe('old content')
    expect(result.modified).toBe('new content')
  })

  it('uses apply_patch diff when file is missing', async () => {
    ;(readFileText as any).mockRejectedValue(new Error('not found'))
    const patch = [
      '*** Begin Patch',
      '*** Update File: a.txt',
      '@@',
      '-old content',
      '+new content',
      '*** End Patch',
    ].join('\n')
    const events = [
      { type: 'FunctionCall', name: 'shell', args: JSON.stringify({ command: ['apply_patch', patch] }) },
    ]
    const result = await getWorkspaceDiff({} as any, 'a.txt', events)
    expect(result.original).toBe('old content')
    expect(result.modified).toBe('new content')
  })
})
