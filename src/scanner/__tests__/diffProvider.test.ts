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
    if (!(entry instanceof MockDirectoryHandle)) throw new DOMException('directory not found', 'NotFoundError')
    return entry
  }
  async getFileHandle(name: string) {
    const entry = this.entries[name]
    if (!(entry instanceof MockFileHandle)) throw new DOMException('file not found', 'NotFoundError')
    return entry
  }
}

function createRoot(fileContent?: string) {
  const fileEntries: Record<string, MockDirectoryHandle | MockFileHandle> = {}
  if (fileContent !== undefined) {
    fileEntries['file.txt'] = new MockFileHandle(fileContent)
  }
  return new MockDirectoryHandle({
    dir: new MockDirectoryHandle(fileEntries),
  })
}

describe('getWorkspaceDiff path normalization', () => {
  it('loads file for Windows-style path', async () => {
    const root = createRoot('content')
    const res = await getWorkspaceDiff(root as any, 'dir\\file.txt', [])
    expect(res.modified).toBe('content')
  })

  it('loads file for path with leading relative segment', async () => {
    const root = createRoot('content')
    const res = await getWorkspaceDiff(root as any, '../dir/file.txt', [])
    expect(res.modified).toBe('content')
  })
})

describe('getWorkspaceDiff event handling', () => {
  it('uses latest FileChange diff as original', async () => {
    const root = createRoot('after')
    const diff = ['--- dir/file.txt', '+++ dir/file.txt', '@@', '-before', '+after'].join('\n')
    const events = [{ type: 'FileChange', path: 'dir/file.txt', diff }]
    const res = await getWorkspaceDiff(root as any, 'dir/file.txt', events)
    expect(res.original).toBe('before')
    expect(res.modified).toBe('after')
  })

  it('falls back to apply_patch when file missing', async () => {
    const root = createRoot(undefined)
    const patch = [
      '*** Begin Patch',
      '*** Update File: dir/file.txt',
      '@@',
      '-before',
      '+after',
      '*** End Patch',
    ].join('\n')
    const events = [
      {
        type: 'FunctionCall',
        name: 'shell',
        args: JSON.stringify({ command: ['apply_patch', patch] }),
      },
    ]
    const res = await getWorkspaceDiff(root as any, 'dir/file.txt', events)
    expect(res.original).toBe('before')
    expect(res.modified).toBe('after')
  })
})

