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
  try { modified = await readFileText(root, normalize(path)) } catch {}

  // Try to find a recent FileChange with a diff for baseline
  let original = ''
  try {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i] as any
      if (ev && ev.type === 'FileChange' && normalize(ev.path) === target && ev.diff) {
        const sides = parseUnifiedDiffToSides(ev.diff)
        original = sides.original
        break
      }
    }
  } catch {}

  // Fallback: inspect recent apply_patch payloads for this path
  if (!original) {
    try {
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i] as any
        if (!isApplyPatchFunction(ev)) continue
        const patchText = extractApplyPatchText(ev.args)
        if (!patchText) continue
        const ops = parseApplyPatch(patchText)
        for (const op of ops) {
          const opOld = normalize(op.path)
          const opNew = op.newPath ? normalize(op.newPath) : undefined
          if (opOld === target || opNew === target) {
            const sides = parseUnifiedDiffToSides(op.unifiedDiff)
            original = sides.original
            // If we still don't have modified content (e.g., file no longer present), leave modified as-is
            if (!modified) modified = sides.modified
            throw new Error('found')
          }
        }
      }
    } catch (e) {
      // swallow control exception used to break nested loops
    }
  }

  return { original, modified }
}
