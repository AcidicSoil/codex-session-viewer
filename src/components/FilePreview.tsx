import * as React from 'react'
import type { ResponseItem } from '../types/events'
import { parseUnifiedDiffToSides, languageFromPath } from '../utils/diff'
import { analyzeDiff, safeTruncate } from '../utils/guards'
import { Button } from './ui/button'

export interface FilePreviewProps {
  path: string
  events: readonly ResponseItem[]
  onOpenDiff?: (opts: { path: string; diff?: string }) => void
  maxChars?: number
}

export default function FilePreview({ path, events, onOpenDiff, maxChars = 200_000 }: FilePreviewProps) {
  // Find the last FileChange event for this path
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
  const lang = languageFromPath(path)

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 flex items-center justify-between gap-2">
        <div className="truncate" title={path}>{path}</div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{lang}</span>
          <Button size="sm" variant="outline" onClick={() => onOpenDiff?.({ path, diff: lastChange?.diff })}>
            Open diff
          </Button>
        </div>
      </div>
      <pre className="text-xs bg-gray-50 rounded p-2 max-h-64 overflow-auto whitespace-pre-wrap" aria-label="File preview">
{display || 'No preview content.'}
      </pre>
      <div className="text-xs text-gray-500">{info}{clipped && ' Large file truncated.'}</div>
    </div>
  )
}
