import * as React from 'react'
import type { ResponseItem } from '../types/events'
import { parseUnifiedDiffToSides } from '../utils/diff'
import { getLanguageForPath } from '../utils/language'
import { analyzeDiff, safeTruncate } from '../utils/guards'
import { Button } from './ui/button'
import { isApplyPatchFunction } from '../utils/functionFilters'
import { extractApplyPatchText, parseApplyPatch } from '../parsers/applyPatch'

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
  let unifiedForOpen: string | undefined
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
      unifiedForOpen = lastChange.diff
    } catch {
      info = 'Could not parse diff; showing raw diff.'
      previewText = guard.large ? safeTruncate(lastChange.diff, 200_000) : lastChange.diff
      unifiedForOpen = lastChange.diff
    }
  } else {
    // Fallback: derive preview from latest apply_patch affecting this path
    const normalize = (p: string) => {
      if (!p) return ''
      let s = p.replace(/\\/g, '/').replace(/^\.+\//, '')
      while (s.startsWith('/')) s = s.slice(1)
      return s.replace(/\/{2,}/g, '/')
    }
    const target = normalize(path)
    for (let i = events.length - 1; i >= 0; i--) {
      const ev: any = events[i]
      if (!isApplyPatchFunction(ev)) continue
      try {
        const patchText = extractApplyPatchText(ev.args)
        if (!patchText) continue
        const ops = parseApplyPatch(patchText)
        for (const op of ops) {
          const opOld = normalize(op.path)
          const opNew = op.newPath ? normalize(op.newPath) : undefined
          if (opOld === target || opNew === target) {
            const { modified } = parseUnifiedDiffToSides(op.unifiedDiff)
            previewText = safeTruncate(modified, 200_000)
            info = 'Preview shows modified side from latest apply_patch affecting this file.'
            unifiedForOpen = op.unifiedDiff
            i = -1 // break outer loop
            break
          }
        }
      } catch {}
    }
    if (!previewText) info = 'No diff available for this file.'
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
      <div className="text-xs text-gray-500 flex items-center justify-between">
        <span>{info}{clipped && ' Large file truncated.'}</span>
        {onOpenDiff && unifiedForOpen && (
          <Button size="sm" variant="outline" onClick={() => onOpenDiff({ path, diff: unifiedForOpen! })}>Open diff</Button>
        )}
      </div>
    </div>
  )
}
