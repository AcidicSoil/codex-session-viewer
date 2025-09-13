import { describe, it, expect } from 'vitest'
import { analyzeFileChanges } from '../fileChanges'
import type { ResponseItem } from '../../types'

describe('analyzeFileChanges', () => {
  it('maps files and call ids from apply_patch events', () => {
    const patch = [
      '*** Begin Patch',
      '*** Add File: foo.txt',
      '+hello',
      '*** Update File: bar.txt',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
      '*** End Patch',
    ].join('\n')

    const events: ResponseItem[] = [
      {
        type: 'FunctionCall',
        name: 'shell',
        args: JSON.stringify({ command: ['apply_patch', patch] }),
        result: { output: 'Success. Updated the following files:\nA foo.txt\nM bar.txt\n' },
        call_id: 'c1',
        at: '2025-01-01T00:00:00Z',
        index: 1,
      } as any,
    ]

    const res = analyzeFileChanges(events)
    expect(res.get('foo.txt')?.length).toBe(1)
    expect(res.get('bar.txt')?.[0]?.diff).toContain('@@')
    expect(res.callIdToFiles.get('c1')).toEqual(['foo.txt', 'bar.txt'])
  })
})

