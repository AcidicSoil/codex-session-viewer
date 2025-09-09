/// <reference lib="webworker" />
import { getHash, putHash } from '../utils/session-db'

async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function scanDir(dir: FileSystemDirectoryHandle, prefix = ''): Promise<void> {
  for await (const [name, handle] of (dir as any).entries()) {
    const path = prefix ? `${prefix}/${name}` : name
    if (handle.kind === 'file') {
      const existing = await getHash(path)
      const file = await handle.getFile()
      const mtime = file.lastModified
      if (existing?.mtime === mtime) continue
      const hash = await hashFile(file)
      if (existing?.hash === hash) continue
      await putHash(path, hash, mtime)
    } else if (handle.kind === 'directory') {
      await scanDir(handle, path)
    }
  }
}

self.onmessage = async (e: MessageEvent<FileSystemDirectoryHandle[]>) => {
  const roots = e.data
  for (const dir of roots) {
    await scanDir(dir)
  }
  ;(self as any).postMessage('done')
}
