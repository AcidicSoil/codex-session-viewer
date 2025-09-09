/// <reference lib="webworker" />
import { putHash } from '../utils/session-db'

async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function scanDir(dir: FileSystemDirectoryHandle, prefix = ''): Promise<void> {
  for await (const [name, handle] of dir.entries()) {
    const path = prefix ? `${prefix}/${name}` : name
    if (handle.kind === 'file') {
      const file = await handle.getFile()
      const hash = await hashFile(file)
      await putHash(path, hash)
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
