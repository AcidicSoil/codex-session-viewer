/// <reference lib="webworker" />
import { getHash, putHash } from '../utils/session-db'

async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

let aborted = false

async function scanDir(dir: FileSystemDirectoryHandle, prefix = ''): Promise<void> {
  for await (const [name, handle] of (dir as any).entries()) {
    if (aborted) return
    const path = prefix ? `${prefix}/${name}` : name
    if (handle.kind === 'file') {
      const existing = await getHash(path)
      const file = await handle.getFile()
      const mtime = file.lastModified
      if (existing?.mtime === mtime) continue
      const hash = await hashFile(file)
      await putHash(path, hash, mtime)
      ;(self as any).postMessage({ type: 'progress', path })
    } else if (handle.kind === 'directory') {
      await scanDir(handle, path)
    }
  }
}

self.onmessage = async (e: MessageEvent<any>) => {
  const msg = e.data
  if (msg === 'abort' || msg?.type === 'abort') {
    aborted = true
    return
  }
  const roots: FileSystemDirectoryHandle[] = msg.roots ?? msg
  for (const dir of roots) {
    if (aborted) break
    await scanDir(dir)
  }
  ;(self as any).postMessage(aborted ? 'aborted' : 'done')
}
