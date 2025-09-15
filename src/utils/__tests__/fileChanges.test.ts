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
  it('maps file changes and apply_patch call outputs', () => {
    const events: ResponseItem[] = [
      {
        type: 'FunctionCall',
        name: 'shell',
        args: JSON.stringify({ command: ['apply_patch', '...'] }),
        result: { output: 'Success. Updated the following files:\nA src/a.ts\nM src/b.ts\n' },
        call_id: 'c1',
      },
      { type: 'FileChange', path: 'src/a.ts', diff: 'd1' },
      { type: 'FileChange', path: 'src/b.ts', diff: 'd2' },
      {
        type: 'FunctionCall',
        name: 'shell',
        args: JSON.stringify({ command: ['apply_patch', '...'] }),
        result: { output: 'Success. Updated the following files:\nM src/a.ts\n' },
        call_id: 'c2',
      },
      { type: 'FileChange', path: 'src/a.ts', diff: 'd3' },
    ] as any

    const res = analyzeFileChanges(events)
    expect(res.files.get('src/a.ts')?.length).toBe(2)
    expect(res.files.get('src/b.ts')?.length).toBe(1)
    expect(res.callToFiles.get('c1')).toEqual(['src/a.ts', 'src/b.ts'])
    expect(res.callToFiles.get('c2')).toEqual(['src/a.ts'])
  })

  it('includes old and new paths for rename outputs', () => {
    const events: ResponseItem[] = [
      {
        type: 'FunctionCall',
        name: 'shell',
        args: JSON.stringify({ command: ['apply_patch', '...'] }),
        result: { output: 'Success. Updated the following files:\nR src/old.ts -> src/new.ts\n' },
        call_id: 'c1',
      },
    ] as any

    const res = analyzeFileChanges(events)
    expect(res.callToFiles.get('c1')).toEqual(['src/old.ts', 'src/new.ts'])
  })
})

