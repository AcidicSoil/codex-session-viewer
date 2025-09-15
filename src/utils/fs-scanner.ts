export type ScanOptions = {
  respectGitignore?: boolean
  ignoreFileName?: string
  includeGlobs?: string[]
  excludeGlobs?: string[]
  followSymlinks?: boolean
  maxFiles?: number
  signal?: AbortSignal
}

export type ScanStats = {
  ignored: number
  scanned: number
  topIgnored: { pattern: string; count: number }[]
  aborted?: boolean
}

type WorkerOptions = Omit<ScanOptions, 'signal'>

const DEFAULT_OPTIONS: Required<Pick<ScanOptions, 'respectGitignore' | 'ignoreFileName' | 'followSymlinks'>> = {
  respectGitignore: true,
  ignoreFileName: '.codexignore',
  followSymlinks: false,
}

type StatsHandler = (stats: ScanStats) => void

type ProgressHandler = (path: string) => void

function setupWorker(
  worker: Worker,
  { signal }: ScanOptions,
): { onProgress: (cb: ProgressHandler) => () => void; onStats: (cb: StatsHandler) => () => void } {
  const progressHandlers = new Set<ProgressHandler>()
  const statsHandlers = new Set<StatsHandler>()

  worker.addEventListener('message', (e) => {
    const msg = e.data
    if (!msg) return
    if (msg.type === 'progress') {
      for (const handler of progressHandlers) handler(msg.path)
    } else if (msg.type === 'stats') {
      for (const handler of statsHandlers) handler(msg as ScanStats)
    }
  })

  const abort = () => worker.postMessage({ type: 'abort' })

  if (signal) {
    if (signal.aborted) abort()
    const onAbort = () => abort()
    signal.addEventListener('abort', onAbort, { once: true })
  }

  return {
    onProgress: (cb: ProgressHandler) => {
      progressHandlers.add(cb)
      return () => progressHandlers.delete(cb)
    },
    onStats: (cb: StatsHandler) => {
      statsHandlers.add(cb)
      return () => statsHandlers.delete(cb)
    },
  }
}

export function startFileSystemScanFromHandle(
  rootHandle: FileSystemDirectoryHandle,
  options: ScanOptions = {},
) {
  const worker = new Worker(new URL('../workers/fs-scanner.ts', import.meta.url), { type: 'module' })
  const { signal, ...rest } = options
  const merged: WorkerOptions = { ...DEFAULT_OPTIONS, ...rest }
  const { onProgress, onStats } = setupWorker(worker, { signal })

  ;(async () => {
    const roots: FileSystemDirectoryHandle[] = [rootHandle]
    worker.postMessage({ type: 'start', roots, options: merged })
  })()

  return {
    worker,
    abort: () => worker.postMessage({ type: 'abort' }),
    onProgress,
    onStats,
  }
}

export async function startFileSystemScanOPFS(options: ScanOptions = {}) {
  const worker = new Worker(new URL('../workers/fs-scanner.ts', import.meta.url), { type: 'module' })
  const { signal, ...rest } = options
  const merged: WorkerOptions = { ...DEFAULT_OPTIONS, ...rest }
  const { onProgress, onStats } = setupWorker(worker, { signal })

  try {
    const roots: FileSystemDirectoryHandle[] = []
    const root = await (navigator as any).storage.getDirectory()
    roots.push(root)
    try {
      const codex = await root.getDirectoryHandle('.codex')
      const sessions = await codex.getDirectoryHandle('sessions')
      roots.push(sessions)
    } catch {}
    worker.postMessage({ type: 'start', roots, options: merged })
  } catch {}

  return {
    worker,
    abort: () => worker.postMessage({ type: 'abort' }),
    onProgress,
    onStats,
  }
}
