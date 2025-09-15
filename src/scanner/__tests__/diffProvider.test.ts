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

describe('getWorkspaceDiff baseline and reconstruction', () => {
  it('selects baseline from latest FileChange diff', async () => {
    const root = createRoot('v2')
    const diff1 = ['--- dir/file.txt', '+++ dir/file.txt', '@@', '-v0', '+v1'].join('\n')
    const diff2 = ['--- dir/file.txt', '+++ dir/file.txt', '@@', '-v1', '+v2'].join('\n')
    const events = [
      { type: 'FileChange', path: 'dir/file.txt', diff: diff1 },
      { type: 'FileChange', path: 'dir/file.txt', diff: diff2 },
    ]
    const res = await getWorkspaceDiff(root as any, 'dir/file.txt', events)
    expect(res.original).toBe('v1')
    expect(res.modified).toBe('v2')
  })

  it('reconstructs content from apply_patch when file missing', async () => {
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

  it('returns empty strings when file missing and no events', async () => {
    const root = createRoot(undefined)
    const res = await getWorkspaceDiff(root as any, 'dir/file.txt', [])
    expect(res.original).toBe('')
    expect(res.modified).toBe('')
  })
})

