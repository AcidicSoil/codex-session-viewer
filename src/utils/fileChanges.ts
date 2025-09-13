import type { ResponseItem, FileChangeEvent } from '../types/events'
import { normalizePath } from './fileTree'

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

