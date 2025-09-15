import ignore, { type Ignore } from 'ignore'
import micromatch from 'micromatch'

export function normalizeToPosix(path: string): string {
  const replaced = path.replace(/\\/g, '/')
  const collapsed = replaced.replace(/\/+/g, '/')
  const withoutLeading = collapsed.replace(/^\.\//, '').replace(/^\/+/, '')
  const withoutTrailing = withoutLeading.replace(/\/+$|^$/, '')
  return withoutTrailing
}

export async function buildIgnoreFromHandle(
  dir: FileSystemDirectoryHandle,
  fileName: string,
): Promise<string[]> {
  try {
    const handle = await dir.getFileHandle(fileName)
    const file = await handle.getFile()
    const text = await file.text()
    return text.split(/\r?\n/)
  } catch (err) {
    return []
  }
}

export interface IgnoreLayer {
  base: string
  matcher: Ignore
}

export interface IgnoreDecision {
  ignored: boolean
  unignored: boolean
}

export function createCompositeMatcher(layers: IgnoreLayer[]): (path: string, isDir: boolean) => IgnoreDecision {
  const normalized = layers.map((layer) => ({
    base: normalizeToPosix(layer.base),
    matcher: layer.matcher,
  }))
  return (rawPath: string, isDir: boolean) => {
    const path = normalizeToPosix(rawPath)
    const withKind = isDir ? (path ? `${path}/` : './') : path || '.'
    let ignored = false
    let unignored = false
    for (const { base, matcher } of normalized) {
      let target: string | null = null
      if (base) {
        if (path === base) {
          target = isDir ? './' : '.'
        } else if (path.startsWith(`${base}/`)) {
          const rel = path.slice(base.length + 1)
          target = rel ? (isDir ? `${rel}/` : rel) : isDir ? './' : '.'
        }
      } else {
        target = withKind
      }
      if (!target) continue
      const res = matcher.test(target)
      if (res.ignored) {
        ignored = true
        unignored = false
      }
      if (res.unignored) {
        ignored = false
        unignored = true
      }
    }
    return { ignored, unignored }
  }
}

export function globMatch(path: string, patterns?: string[]): boolean {
  if (!patterns?.length) return false
  const normalized = normalizeToPosix(path)
  return micromatch.isMatch(normalized, patterns, { dot: true, nocase: false })
}
