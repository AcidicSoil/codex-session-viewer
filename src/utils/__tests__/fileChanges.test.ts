import { describe, it, expect } from 'vitest'
import { getFileHistory } from '../fileChanges'
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

