export function startFileSystemScanFromHandle(rootHandle: FileSystemDirectoryHandle) {
  const worker = new Worker(new URL('../workers/fs-scanner.ts', import.meta.url), {
    type: 'module',
  })

  const progressHandlers = new Set<(path: string) => void>()

  worker.addEventListener('message', (e) => {
    const msg = e.data
    if (msg && msg.type === 'progress') {
      for (const handler of progressHandlers) handler(msg.path)
    }
  })

  ;(async () => {
    const roots: FileSystemDirectoryHandle[] = [rootHandle]
    worker.postMessage({ type: 'start', roots })
  })()

  return {
    worker,
    abort: () => worker.postMessage({ type: 'abort' }),
    onProgress: (cb: (path: string) => void) => {
      progressHandlers.add(cb)
      return () => progressHandlers.delete(cb)
    },
  }
}

export async function startFileSystemScanOPFS() {
  const worker = new Worker(new URL('../workers/fs-scanner.ts', import.meta.url), { type: 'module' })
  const progressHandlers = new Set<(path: string) => void>()
  worker.addEventListener('message', (e) => {
    const msg = e.data
    if (msg && msg.type === 'progress') for (const h of progressHandlers) h(msg.path)
  })
  try {
    const roots: FileSystemDirectoryHandle[] = []
    const root = await (navigator as any).storage.getDirectory()
    roots.push(root)
    worker.postMessage({ type: 'start', roots })
  } catch {}
  return {
    worker,
    abort: () => worker.postMessage({ type: 'abort' }),
    onProgress: (cb: (path: string) => void) => {
      progressHandlers.add(cb)
      return () => progressHandlers.delete(cb)
    },
  }
}
