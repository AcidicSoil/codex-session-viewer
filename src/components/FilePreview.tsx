import * as React from 'react'
import type { ResponseItem } from '../types/events'
import { parseUnifiedDiffToSides } from '../utils/diff'
import { getLanguageForPath } from '../utils/language'
import { analyzeDiff, safeTruncate } from '../utils/guards'

export interface FilePreviewProps {
  /** File path to locate within the event list */
  path: string
  /** Full list of session events to search */
  events: readonly ResponseItem[]
  /** Maximum characters to render in the preview */
  maxChars?: number
}

/**
 * Renders a quick preview of the latest change for a given file path.
 * Searches the provided events in reverse to find the most recent
 * `FileChange` entry and displays a truncated view of the modified side
 * of the diff. Large or binary diffs are guarded to avoid UI jank.
 */
export default function FilePreview({ path, events, maxChars = 200_000 }: FilePreviewProps) {
  // Scan from the end for efficiency since recent events appear last
  const lastChange = React.useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i]
      if ((ev as any).type === 'FileChange' && (ev as any).path === path) return ev as any
    }
    return undefined
  }, [events, path])

  let previewText = ''
  let info = ''
  if (lastChange?.diff) {
    const guard = analyzeDiff(lastChange.diff)
    if (guard.binary) {
      info = 'Binary-looking diff detected. Preview disabled.'
    } else if (guard.large) {
      info = 'Large diff detected. Preview truncated; open full diff if needed.'
    }
    try {
      const { modified } = parseUnifiedDiffToSides(lastChange.diff)
      previewText = guard.large ? safeTruncate(modified, 200_000) : modified
      info = 'Preview shows modified (right) side reconstructed from the latest diff.'
    } catch {
      info = 'Could not parse diff; showing raw diff.'
      previewText = guard.large ? safeTruncate(lastChange.diff, 200_000) : lastChange.diff
    }
  } else {
    info = 'No diff available for this file.'
  }

  const clipped = previewText.length > maxChars
  const display = clipped ? previewText.slice(0, maxChars) + '\n… (truncated)' : previewText
  const lang = getLanguageForPath(path)

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 flex items-center justify-between gap-2">
        <div className="truncate" title={path}>{path}</div>
        <div className="flex items-center gap-2"><span className="text-gray-400">{lang}</span></div>
      </div>
      <pre className="text-xs bg-gray-50 rounded p-2 max-h-64 overflow-auto whitespace-pre-wrap" aria-label="File preview">
{display || 'No preview content.'}
      </pre>
      <div className="text-xs text-gray-500">{info}{clipped && ' Large file truncated.'}</div>
    </div>
  )
}
