import type { ResponseItem, FileChangeEvent } from '../types/events'
import { normalizePath } from './fileTree'
import { extractApplyPatchText, parseApplyPatch } from '../parsers/applyPatch'
import { isApplyPatchFunction } from './functionFilters'

export interface AnalyzeFileChangesResult {
  readonly fileMap: Map<string, (FileChangeEvent & { callId?: string })[]>
  readonly callToFiles: Map<string, string[]>
}

/**
 * Scan events for shell apply_patch calls and map affected files.
 */
export function analyzeFileChanges(events: readonly ResponseItem[]): AnalyzeFileChangesResult {
  const outputs = new Map<string, string>()
  for (const ev of events) {
    const cid = (ev as any).call_id
    if (ev.type === 'LocalShellCall' && cid && typeof (ev as any).stdout === 'string') {
      outputs.set(cid, (ev as any).stdout)
    }
  }

  const fileMap = new Map<string, (FileChangeEvent & { callId?: string })[]>()
  const callToFiles = new Map<string, string[]>()

  for (const ev of events) {
    if (!isApplyPatchFunction(ev)) continue
    const callId = (ev as any).call_id as string | undefined
    const patchText = extractApplyPatchText((ev as any).args)
    if (!patchText) continue
    const ops = parseApplyPatch(patchText)
    const files = new Set<string>(parseOutputFiles(callId ? outputs.get(callId) : undefined))

    for (const op of ops) {
      const path = normalizePath(op.newPath ?? op.path)
      files.add(path)
      const item: FileChangeEvent & { callId?: string } = {
        type: 'FileChange',
        path,
        diff: op.unifiedDiff,
        at: (ev as any).at,
        index: (ev as any).index,
        ...(callId ? { callId } : {}),
      }
      const arr = fileMap.get(path)
      if (arr) arr.push(item)
      else fileMap.set(path, [item])
    }
    if (callId) callToFiles.set(callId, [...files])
  }

  return { fileMap, callToFiles }
}

function parseOutputFiles(stdout?: string): string[] {
  if (!stdout) return []
  const paths: string[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const m = /^[A-Z]\s+(.+)$/.exec(line.trim())
    if (m) paths.push(normalizePath(m[1]!.trim()))
  }
  return paths
}

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
    const ta = a.at ? Date.parse(a.at as string) : undefined
    const tb = b.at ? Date.parse(b.at as string) : undefined
    if (ta !== undefined && tb !== undefined && ta !== tb) return ta - tb
    const ia = a.index ?? 0
    const ib = b.index ?? 0
    return ia - ib
  })
  return history
}

