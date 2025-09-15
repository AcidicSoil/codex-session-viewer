import { readFileText } from '../utils/fs-io'
import { parseUnifiedDiffToSides } from '../utils/diff'
import { isApplyPatchFunction } from '../utils/functionFilters'
import { extractApplyPatchText, parseApplyPatch } from '../parsers/applyPatch'

export async function getWorkspaceDiff(
  root: FileSystemDirectoryHandle,
  path: string,
  events: readonly any[]
): Promise<{ original: string; modified: string }> {
  const normalize = (p: string) => {
    if (!p) return ''
    let s = p.replace(/\\/g, '/').replace(/^\.+\//, '')
    while (s.startsWith('/')) s = s.slice(1)
    return s.replace(/\/{2,}/g, '/')
  }
  const target = normalize(path)

  let modified = ''
  try {
    modified = await readFileText(root, normalize(path))
  } catch (e) {
    if (!(e instanceof DOMException)) throw e
  }

  // Try to find a recent FileChange with a diff for baseline
  let original = ''
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i] as any
    if (ev && ev.type === 'FileChange' && normalize(ev.path) === target && ev.diff) {
      const sides = parseUnifiedDiffToSides(ev.diff)
      original = sides.original
      break
    }
  }

  // Fallback: inspect recent apply_patch payloads for this path
  if (!original) {
    outer: for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i] as any
      if (!isApplyPatchFunction(ev)) continue
      const patchText = extractApplyPatchText(ev.args)
      if (!patchText) continue
      let ops
      try {
        ops = parseApplyPatch(patchText)
      } catch (e) {
        if (e instanceof SyntaxError) continue
        throw e
      }
      for (const op of ops) {
        const opOld = normalize(op.path)
        const opNew = op.newPath ? normalize(op.newPath) : undefined
        if (opOld === target || opNew === target) {
          const sides = parseUnifiedDiffToSides(op.unifiedDiff)
          original = sides.original
          // If we still don't have modified content (e.g., file no longer present), leave modified as-is
          if (!modified) modified = sides.modified
          break outer
        }
      }
    }
  }

  return { original, modified }
}
