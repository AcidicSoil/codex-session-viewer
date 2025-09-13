/** Parser for Codex CLI apply_patch envelopes embedded in FunctionCall events. */

export type PatchOpType = 'add' | 'update' | 'delete'

export interface ParsedPatchOp {
  op: PatchOpType
  path: string
  newPath?: string
  /** Minimal unified diff suitable for parseUnifiedDiffToSides */
  unifiedDiff: string
}

/** Try to extract the raw patch text from args or result-like payloads. */
export function extractApplyPatchText(payload: unknown): string | null {
  try {
    let obj: any = payload as any
    if (obj == null) return null
    // Many sessions serialize payloads as a JSON string
    if (typeof obj === 'string') {
      try {
        obj = JSON.parse(obj)
      } catch {
        return obj.includes('*** Begin Patch') ? obj : null
      }
    }
    if (obj && Array.isArray(obj.command) && obj.command[0] === 'apply_patch') {
      const patch = obj.command[1]
      if (typeof patch === 'string') return patch
    }
    const visited = new Set<any>()
    const stack = [obj]
    while (stack.length) {
      const cur = stack.pop()
      if (cur == null || visited.has(cur)) continue
      visited.add(cur)
      if (typeof cur === 'string') {
        if (cur.includes('*** Begin Patch')) return cur
        continue
      }
      if (typeof cur === 'object') {
        for (const v of Object.values(cur)) stack.push(v)
      }
    }
    return null
  } catch {
    return null
  }
}

/** Try to extract the raw patch text from a shell command here-doc. */
export function extractApplyPatchFromCommand(command: string): string | null {
  try {
    if (!command) return null
    const m = /apply_patch\s+<<['"]?([A-Za-z0-9_-]+)['"]?\n([\s\S]*)/.exec(command)
    if (!m) return null
    const marker = m[1]
    const rest = m[2] ?? ''
    const endMarker = `\n${marker}`
    const idx = rest.indexOf(endMarker)
    if (idx === -1) return null
    const patch = rest.slice(0, idx)
    return patch || null
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
