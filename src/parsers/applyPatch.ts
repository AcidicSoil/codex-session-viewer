/** Parser for Codex CLI apply_patch envelopes embedded in FunctionCall events. */

export type PatchOpType = 'add' | 'update' | 'delete'

export interface ParsedPatchOp {
  op: PatchOpType
  path: string
  newPath?: string
  /** Minimal unified diff suitable for parseUnifiedDiffToSides */
  unifiedDiff: string
}

/** Try to extract the raw patch text from a FunctionCall.args payload. */
export function extractApplyPatchText(args: unknown): string | null {
  try {
    let obj: any = args as any
    if (obj == null) return null
    // Many sessions serialize args as a JSON string
    if (typeof obj === 'string') {
      obj = JSON.parse(obj)
    }
    if (obj && Array.isArray(obj.command) && obj.command[0] === 'apply_patch') {
      const patch = obj.command[1]
      return typeof patch === 'string' ? patch : null
    }
    return null
  } catch {
    return null
  }
}

/**
 * Parse an apply_patch envelope (*** Begin Patch ... *** End Patch) into file-level ops.
 * Produces minimal unified diffs so existing utilities can render both sides.
 */
export function parseApplyPatch(patchText: string): ParsedPatchOp[] {
  const lines = normalizeNewlines(patchText).split('\n')
  const ops: ParsedPatchOp[] = []

  let i = 0
  const nextHeader = () => (lines[i] ?? '').startsWith('*** ')

  // scan between Begin/End
  while (i < lines.length) {
    const line = lines[i]
    if (line?.startsWith('*** Add File: ')) {
      const path = line.slice('*** Add File: '.length).trim()
      i++
      const content: string[] = []
      while (i < lines.length && !nextHeader() && !(lines[i] ?? '').startsWith('@@')) {
        const l = lines[i] ?? ''
        if (l.startsWith('+')) content.push(l.slice(1))
        i++
      }
      const hunkHeader = `@@ -0,0 +1,${Math.max(1, content.length)} @@`
      const unified = [
        `--- /dev/null`,
        `+++ ${path}`,
        hunkHeader,
        ...content.map((c) => `+${c}`),
      ].join('\n')
      ops.push({ op: 'add', path, unifiedDiff: unified })
      continue
    }

    if (line?.startsWith('*** Delete File: ')) {
      const path = line.slice('*** Delete File: '.length).trim()
      i++
      // We do not have content; emit an empty-delete hunk
      const unified = [`--- ${path}`, `+++ /dev/null`, `@@ -1,1 +0,0 @@`, `-`].join('\n')
      ops.push({ op: 'delete', path, unifiedDiff: unified })
      continue
    }

    if (line?.startsWith('*** Update File: ')) {
      let path = line.slice('*** Update File: '.length).trim()
      i++
      let newPath: string | undefined
      {
        const li = lines[i] ?? ''
        if (li.startsWith('*** Move to: ')) {
          newPath = li.slice('*** Move to: '.length).trim()
          i++
        }
      }
      const diffLines: string[] = []
      // Collect only unified diff hunk lines until next header/end
      while (i < lines.length && !nextHeader()) {
        const l = lines[i] ?? ''
        if (
          l.startsWith('@@') ||
          l.startsWith(' ') ||
          l.startsWith('+') ||
          l.startsWith('-') ||
          l.startsWith('\\ No newline')
        ) {
          diffLines.push(l)
        }
        i++
      }
      // Ensure at least one hunk header so downstream parser engages
      if (!diffLines.some((l) => l.startsWith('@@'))) {
        diffLines.unshift('@@ -1,1 +1,1 @@')
      }
      const headerOld = `--- ${path}`
      const headerNew = `+++ ${newPath ?? path}`
      const unified = [headerOld, headerNew, ...diffLines].join('\n')
      ops.push({ op: 'update', path, newPath, unifiedDiff: unified })
      continue
    }

    i++
  }

  return ops
}

function normalizeNewlines(s: string) {
  return s.replace(/\r\n/g, '\n')
}
