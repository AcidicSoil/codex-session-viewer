import { describe, it, expect, vi } from 'vitest'

vi.mock('../../utils/fs-io', () => ({
  readFileText: vi.fn(),
}))

import { getWorkspaceDiff } from '../diffProvider'
import { readFileText } from '../../utils/fs-io'
import * as applyPatchModule from '../../parsers/applyPatch'

const mockReadFileText = vi.mocked(readFileText)

describe('getWorkspaceDiff', () => {
  it('uses FileChange diff when available', async () => {
    mockReadFileText.mockResolvedValue('current')
    const diff = [
      '--- a/a.txt',
      '+++ b/a.txt',
      '@@ -1 +1 @@',
      '-old',
      '+new',
    ].join('\n')
    const events = [{ type: 'FileChange', path: 'a.txt', diff }]
    const res = await getWorkspaceDiff({} as any, 'a.txt', events)
    expect(res.original).toBe('old')
    expect(res.modified).toBe('current')
  })

  it('falls back to apply_patch payloads and stops after first match', async () => {
    mockReadFileText.mockReset()
    mockReadFileText.mockRejectedValue(new DOMException('nf'))
    const spy = vi.spyOn(applyPatchModule, 'parseApplyPatch')
    const makeEvent = (path: string, old: string, mod: string) => ({
      type: 'FunctionCall',
      name: 'shell',
      args: { command: ['apply_patch', ['*** Begin Patch', `*** Update File: ${path}`, '@@', `-${old}`, `+${mod}`, '*** End Patch'].join('\n')] },
    })
    const events = [
      makeEvent('other.txt', 'x', 'y'),
      makeEvent('file.txt', 'old', 'new'),
      makeEvent('later.txt', 'a', 'b'),
    ]
    const res = await getWorkspaceDiff({} as any, 'file.txt', events)
    expect(res).toEqual({ original: 'old', modified: 'new' })
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

