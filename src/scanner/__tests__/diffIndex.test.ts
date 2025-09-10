import { describe, it, expect } from 'vitest'
import { buildChangeSet } from '../diffIndex'

describe('buildChangeSet', () => {
  it('detects added, modified, and deleted files', () => {
    const before = [
      { path: 'a.txt', hash: 'aaa', updatedAt: 1 },
      { path: 'b.txt', hash: 'bbb', updatedAt: 1 },
      { path: 'c.txt', hash: 'ccc', updatedAt: 1 },
    ]
    const after = [
      { path: 'a.txt', hash: 'aaa', updatedAt: 2 },
      { path: 'b.txt', hash: 'bbb2', updatedAt: 2 },
      { path: 'd.txt', hash: 'ddd', updatedAt: 2 },
    ]
    const cs = buildChangeSet(before as any, after as any)
    expect(cs.added).toBe(1)
    expect(cs.modified).toBe(1)
    expect(cs.deleted).toBe(1)
  })
})

