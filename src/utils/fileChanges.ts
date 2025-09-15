import type { ResponseItem, FileChangeEvent } from '../types/events'
import { normalizePath } from './fileTree'
import { isApplyPatchFunction } from './functionFilters'

export interface FileHistoryEntry {
  readonly path: string
  readonly diff?: string
  readonly at?: string
  readonly index?: number
}

/**
 * Return a list of diff entries for a specific file path in chronological order.
 */
export function getFileHistory(events: readonly ResponseItem[], filePath: string): FileHistoryEntry[] {
  const target = normalizePath(filePath)
  const history: FileHistoryEntry[] = []
  for (const ev of events) {
    if (ev.type === 'FileChange') {
      const fe = ev as FileChangeEvent
      if (normalizePath(fe.path) === target) {
        history.push({ path: fe.path, diff: fe.diff, at: fe.at, index: fe.index })
      }
    }
  }
  history.sort((a, b) => {
    const ta = a.at ? Date.parse(a.at) : Number.NaN
    const tb = b.at ? Date.parse(b.at) : Number.NaN
    if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb
    const ia = a.index ?? 0
    const ib = b.index ?? 0
    return ia - ib
  })
  return history
}

export interface AnalyzeFileChangesResult {
  readonly files: Map<string, FileChangeEvent[]>
  readonly callToFiles: Map<string, readonly string[]>
}

/**
 * Aggregate file change events and map apply_patch call IDs to affected files.
 */
export function analyzeFileChanges(events: readonly ResponseItem[]): AnalyzeFileChangesResult {
  const files = new Map<string, FileChangeEvent[]>()
  const callToFiles = new Map<string, readonly string[]>()

  for (const ev of events) {
    if (ev.type === 'FileChange') {
      const fe = ev as FileChangeEvent
      const p = normalizePath(fe.path)
      const arr = files.get(p)
      if (arr) arr.push(fe)
      else files.set(p, [fe])
      continue
    }

    if (isApplyPatchFunction(ev)) {
      const callId = (ev as any).call_id ?? (ev as any).callId ?? (ev as any).id
      const paths = extractPathsFromResult((ev as any).result)
      if (callId && paths.length) callToFiles.set(callId, paths)
    }
  }

  return { files, callToFiles }
}

function extractPathsFromResult(res: unknown): string[] {
  let txt: string | undefined
  if (!res) return []
  if (typeof res === 'string') txt = res
  else if (typeof res === 'object') txt = typeof (res as any).output === 'string' ? (res as any).output : undefined
  if (!txt) return []
  const out: string[] = []
  for (const line of String(txt).split(/\r?\n/)) {
    // handle rename/copy lines like "R old.ts -> new.ts" or "C a.ts => b.ts"
    const rename = /^\s*[RC]\s+(.+?)\s+(?:->|=>)\s+(.+)$/.exec(line)
    if (rename && rename[1] && rename[2]) {
      out.push(normalizePath(rename[1]))
      out.push(normalizePath(rename[2]))
      continue
    }

    const m = /^\s*[A-Z]\s+(.+)$/.exec(line)
    if (m && m[1]) out.push(normalizePath(m[1]))
  }
  return out
}

