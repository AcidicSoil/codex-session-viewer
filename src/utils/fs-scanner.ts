export function startFileSystemScan() {
  const worker = new Worker(new URL('../workers/fs-scanner.ts', import.meta.url), { type: 'module' })
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
      worker.postMessage(roots)
    } catch {
      // ignore
    }
  })()
  return worker
}
