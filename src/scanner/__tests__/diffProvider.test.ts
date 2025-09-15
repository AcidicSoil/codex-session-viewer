import { describe, it, expect } from 'vitest'
import { getWorkspaceDiff } from '../diffProvider'

// Minimal in-memory implementations of FileSystem handles for testing
class MockFileHandle {
  constructor(private content: string) {}
  async getFile() {
    return { text: async () => this.content }
  }
}

class MockDirectoryHandle {
  constructor(private entries: Record<string, MockDirectoryHandle | MockFileHandle>) {}
  async getDirectoryHandle(name: string) {
    const entry = this.entries[name]
    if (!(entry instanceof MockDirectoryHandle)) throw new Error('directory not found')
    return entry
  }
  async getFileHandle(name: string) {
    const entry = this.entries[name]
    if (!(entry instanceof MockFileHandle)) throw new Error('file not found')
    return entry
  }
}

function createRoot() {
  return new MockDirectoryHandle({
    dir: new MockDirectoryHandle({
      'file.txt': new MockFileHandle('content'),
    }),
  })
}

describe('getWorkspaceDiff path normalization', () => {
  it('loads file for Windows-style path', async () => {
    const root = createRoot()
    const res = await getWorkspaceDiff(root as any, 'dir\\file.txt', [])
    expect(res.modified).toBe('content')
  })

  it('loads file for path with leading relative segment', async () => {
    const root = createRoot()
    const res = await getWorkspaceDiff(root as any, '../dir/file.txt', [])
    expect(res.modified).toBe('content')
  })
})

