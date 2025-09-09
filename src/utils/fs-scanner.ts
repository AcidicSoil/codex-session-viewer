export function startFileSystemScan() {
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
    try {
      const roots: FileSystemDirectoryHandle[] = []
      const root = await (navigator as any).storage.getDirectory()
      roots.push(root)
      try {
        const codex = await root.getDirectoryHandle('.codex')
        const sessions = await codex.getDirectoryHandle('sessions')
        roots.push(sessions)
      } catch {}
      worker.postMessage({ type: 'start', roots })
    } catch {
      // ignore
    }
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
