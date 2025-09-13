import { describe, it, expect } from 'vitest'
import { getFileHistory, analyzeFileChanges } from '../fileChanges'
import type { ResponseItem } from '../../types/events'

describe('getFileHistory', () => {
  it('returns diffs in chronological order for a path', () => {
    const events: ResponseItem[] = [
      { type: 'Message', role: 'user', content: 'hi' },
      { type: 'FileChange', path: 'src/a.ts', diff: 'diff1', at: '2024-01-01T00:00:00Z', index: 1 },
      { type: 'FileChange', path: 'src/b.ts', diff: 'diff2', at: '2024-01-01T00:01:00Z', index: 2 },
      { type: 'FileChange', path: 'src/a.ts', diff: 'diff3', at: '2024-01-01T00:02:00Z', index: 3 },
    ] as any
    const hist = getFileHistory(events, 'src/a.ts')
    expect(hist).toHaveLength(2)
    expect(hist[0]!.diff).toBe('diff1')
    expect(hist[1]!.diff).toBe('diff3')
  })
})

describe('analyzeFileChanges', () => {
  it('maps apply_patch calls to file changes', () => {
    const patch = `*** Begin Patch\n*** Add File: src/a.ts\n@@\n+hi\n*** End Patch\n`
    const events: ResponseItem[] = [
      {
        type: 'FunctionCall',
        name: 'shell',
        args: JSON.stringify({ command: ['apply_patch', patch] }),
        call_id: 'c1',
        at: '2024-01-01T00:00:00Z',
        index: 1,
      },
      {
        type: 'LocalShellCall',
        command: 'apply_patch',
        stdout: 'Success. Updated the following files:\nA src/a.ts\n',
        call_id: 'c1',
        at: '2024-01-01T00:00:01Z',
        index: 2,
      },
    ] as any
    const res = analyzeFileChanges(events)
    const hist = res.fileMap.get('src/a.ts')
    expect(hist).toBeDefined()
    expect(hist![0]!.diff).toContain('+++ src/a.ts')
    expect(res.callToFiles.get('c1')).toEqual(['src/a.ts'])
  })
})

