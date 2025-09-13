import type { ResponseItem, FileChangeEvent } from '../types'
import { isApplyPatchFunction } from './functionFilters'
import { extractApplyPatchText, parseApplyPatch } from '../parsers/applyPatch'

export interface FileChangeIndex extends Map<string, FileChangeEvent[]> {
  callIdToFiles: Map<string, string[]>
}

function outputText(res: unknown): string {
  if (typeof res === 'string') return res
  if (res && typeof res === 'object') {
    const out = (res as any).output
    if (typeof out === 'string') return out
    return JSON.stringify(res)
  }
  return ''
}

function parseOutputForPaths(text: string): string[] {
  const paths: string[] = []
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^[AMD]\s+(.+)$/)
    if (m) paths.push(m[1]!.trim())
  }
  return paths
}

export function analyzeFileChanges(events: readonly ResponseItem[]): FileChangeIndex {
  const fileToChanges = new Map<string, FileChangeEvent[]>() as FileChangeIndex
  const callToFiles = new Map<string, string[]>()

  for (const ev of events) {
    if (!isApplyPatchFunction(ev)) continue
    const callId = String((ev as any).call_id || ev.id || '')
    if (!callId) continue

    const patch = extractApplyPatchText((ev as any).args)
    const ops = patch ? parseApplyPatch(patch) : []

    const text = outputText((ev as any).result)
    const paths = parseOutputForPaths(text)
    if (paths.length === 0 && ops.length > 0) {
      for (const op of ops) paths.push(op.newPath ?? op.path)
    }
    callToFiles.set(callId, Array.from(new Set(paths)))

    for (const path of paths) {
      const op = ops.find((o) => o.path === path || o.newPath === path)
      const change: FileChangeEvent = {
        type: 'FileChange',
        path,
        diff: op?.unifiedDiff,
        id: callId,
        at: (ev as any).at,
        index: (ev as any).index,
      }
      const arr = fileToChanges.get(path)
      if (arr) arr.push(change)
      else fileToChanges.set(path, [change])
    }
  }

  fileToChanges.callIdToFiles = callToFiles
  return fileToChanges
}

