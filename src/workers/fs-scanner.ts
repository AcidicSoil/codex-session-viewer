/// <reference lib="webworker" />
import ignore from 'ignore'
import { getHash, putHash } from '../utils/session-db'
import {
  buildIgnoreFromHandle,
  createCompositeMatcher,
  globMatch,
  normalizeToPosix,
  type IgnoreLayer,
} from '../utils/ignore-utils'

async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

type ScanOptions = {
  respectGitignore?: boolean
  ignoreFileName?: string
  includeGlobs?: string[]
  excludeGlobs?: string[]
  followSymlinks?: boolean
  maxFiles?: number
}

type StatsMessage = {
  type: 'stats'
  ignored: number
  scanned: number
  topIgnored: { pattern: string; count: number }[]
  aborted?: boolean
}

const DEFAULTS: Required<Pick<ScanOptions, 'respectGitignore' | 'ignoreFileName' | 'followSymlinks'>> = {
  respectGitignore: true,
  ignoreFileName: '.codexignore',
  followSymlinks: false,
}

const BUILT_IN_IGNORE = ignore().add(['.git/', 'node_modules/', '.DS_Store', 'Thumbs.db', '~$*', '*.swp'])
const MAX_CONCURRENCY = 8

type ResolvedOptions = {
  respectGitignore: boolean
  ignoreFileName: string
  includeGlobs: string[]
  excludeGlobs: string[]
  followSymlinks: boolean
  maxFiles?: number
}

let aborted = false
let options: ResolvedOptions
let scannedCount = 0
let ignoredCount = 0
let processedFiles = 0
const ignoredRoots = new Map<string, number>()
const loggedErrors = new Set<string>()
let visitedDirs = new WeakSet<FileSystemDirectoryHandle>()

function logErrorOnce(path: string, error: unknown) {
  const key = `${path}|${(error as any)?.name ?? 'error'}`
  if (loggedErrors.has(key)) return
  loggedErrors.add(key)
  console.debug('scan error', path, error)
}

function trackIgnored(path: string) {
  ignoredCount++
  const normalized = normalizeToPosix(path)
  if (!normalized) return
  const segment = normalized.includes('/') ? `${normalized.split('/')[0]}/**` : normalized
  ignoredRoots.set(segment, (ignoredRoots.get(segment) ?? 0) + 1)
}

function sanitizePatterns(patterns?: string[]): string[] {
  return (patterns ?? []).map((p) => p.trim()).filter(Boolean)
}

async function extendLayers(
  dir: FileSystemDirectoryHandle,
  base: string,
  codexLayers: IgnoreLayer[],
  gitLayers: IgnoreLayer[],
): Promise<[IgnoreLayer[], IgnoreLayer[]]> {
  let codex = codexLayers
  let git = gitLayers

  try {
    const lines = options.ignoreFileName ? await buildIgnoreFromHandle(dir, options.ignoreFileName) : []
    if (lines.length) {
      codex = [...codexLayers, { base, matcher: ignore().add(lines) }]
    }
  } catch (err) {
    logErrorOnce(base || '.', err)
  }

  if (options.respectGitignore) {
    try {
      const lines = await buildIgnoreFromHandle(dir, '.gitignore')
      if (lines.length) {
        git = [...gitLayers, { base, matcher: ignore().add(lines) }]
      }
    } catch (err) {
      logErrorOnce(base || '.', err)
    }
  }

  return [codex, git]
}

async function shouldSkipDirectory(
  root: FileSystemDirectoryHandle,
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  if (options.followSymlinks) return false
  try {
    const resolved = await root.resolve(handle)
    return !resolved
  } catch (err) {
    // Some browsers throw; fall back to visiting
    return false
  }
}

async function scanDir(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  codexLayers: IgnoreLayer[],
  gitLayers: IgnoreLayer[],
  root: FileSystemDirectoryHandle,
): Promise<void> {
  if (aborted) return
  if (visitedDirs.has(dir)) return
  visitedDirs.add(dir)

  const base = normalizeToPosix(prefix)
  const [codex, git] = await extendLayers(dir, base, codexLayers, gitLayers)
  const codexMatcher = createCompositeMatcher(codex)
  const gitMatcher = createCompositeMatcher(git)

  const dirTasks: Array<() => Promise<void>> = []

  try {
    for await (const [name, handle] of (dir as any).entries()) {
      if (aborted) return
      const rawPath = base ? `${base}/${name}` : String(name)
      const path = normalizeToPosix(rawPath)
      const isDir = handle.kind === 'directory'
      const target = isDir ? `${path}/` : path

      const includeHit = globMatch(target, options.includeGlobs) || (isDir && globMatch(`${path}/**`, options.includeGlobs))
      let excludedByGlob = false
      if (!includeHit) {
        excludedByGlob =
          globMatch(target, options.excludeGlobs) ||
          (isDir && globMatch(`${path}/**`, options.excludeGlobs))
      }

      let ignored = false
      let allowFromIgnore = false
      if (!includeHit) {
        const codexDecision = codexMatcher(path, isDir)
        if (codexDecision.ignored) ignored = true
        if (codexDecision.unignored) allowFromIgnore = true
        if (!ignored && options.respectGitignore) {
          const gitDecision = gitMatcher(path, isDir)
          if (gitDecision.ignored && !allowFromIgnore) ignored = true
          if (gitDecision.unignored) allowFromIgnore = true
        }
        if (!ignored && !allowFromIgnore && excludedByGlob) ignored = true
        if (!ignored && BUILT_IN_IGNORE.test(target).ignored) ignored = true
      }

      if (ignored) {
        trackIgnored(path || name)
        continue
      }

      if (isDir) {
        if (aborted) return
        if (!options.followSymlinks) {
          const skipSymlink = await shouldSkipDirectory(root, handle)
          if (skipSymlink) {
            trackIgnored(path || name)
            continue
          }
        }
        dirTasks.push(() => scanDir(handle, path, codex, git, root))
        continue
      }

      if (options.maxFiles && processedFiles >= options.maxFiles) {
        aborted = true
        return
      }

      processedFiles++
      scannedCount++

      try {
        const existing = await getHash(path)
        const file = await handle.getFile()
        const mtime = file.lastModified
        if (existing?.mtime === mtime) continue
        const hash = await hashFile(file)
        await putHash(path, hash, mtime)
        ;(self as any).postMessage({ type: 'progress', path })
      } catch (err) {
        logErrorOnce(path, err)
      }

      if (aborted) return
    }
  } catch (err) {
    logErrorOnce(base || '.', err)
  }

  while (dirTasks.length && !aborted) {
    const batch = dirTasks.splice(0, MAX_CONCURRENCY)
    await Promise.allSettled(batch.map((fn) => fn()))
  }
}

function emitStats() {
  const entries = Array.from(ignoredRoots.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([pattern, count]) => ({ pattern, count }))
  const payload: StatsMessage = {
    type: 'stats',
    ignored: ignoredCount,
    scanned: scannedCount,
    topIgnored: entries,
    aborted,
  }
  ;(self as any).postMessage(payload)
}

self.onmessage = async (event: MessageEvent<any>) => {
  const msg = event.data
  if (msg === 'abort' || msg?.type === 'abort') {
    aborted = true
    return
  }

  if (!msg || msg.type !== 'start') return

  const { roots = [], options: rawOptions = {} } = msg
  const includeGlobs = sanitizePatterns(rawOptions.includeGlobs)
  const excludeGlobs = sanitizePatterns(rawOptions.excludeGlobs)

  options = {
    respectGitignore: rawOptions.respectGitignore ?? DEFAULTS.respectGitignore,
    ignoreFileName: rawOptions.ignoreFileName ?? DEFAULTS.ignoreFileName,
    followSymlinks: rawOptions.followSymlinks ?? DEFAULTS.followSymlinks,
    includeGlobs,
    excludeGlobs,
    maxFiles: rawOptions.maxFiles,
  }

  aborted = false
  scannedCount = 0
  ignoredCount = 0
  processedFiles = 0
  ignoredRoots.clear()
  loggedErrors.clear()
  visitedDirs = new WeakSet<FileSystemDirectoryHandle>()

  for (const root of roots as FileSystemDirectoryHandle[]) {
    if (aborted) break
    try {
      await scanDir(root, '', [], [], root)
    } catch (err) {
      logErrorOnce('.', err)
    }
  }

  emitStats()
  ;(self as any).postMessage(aborted ? 'aborted' : 'done')
}
