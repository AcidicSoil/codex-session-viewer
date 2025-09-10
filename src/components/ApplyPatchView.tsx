import * as React from 'react'
import type { ResponseItem } from '../types'
import DiffViewer from './DiffViewer'
import { parseUnifiedDiffToSides } from '../utils/diff'
import { extractApplyPatchText, parseApplyPatch } from '../parsers/applyPatch'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

export interface ApplyPatchViewProps {
  item: Extract<ResponseItem, { type: 'FunctionCall' }>
  /** Optional externally paired result metadata (exit_code, duration_seconds) */
  pairedResultMeta?: { exit_code?: number; exitCode?: number; duration_seconds?: number; durationSeconds?: number } | null
}

export default function ApplyPatchView({ item, pairedResultMeta }: ApplyPatchViewProps) {
  const patchText = React.useMemo(() => extractApplyPatchText(item.args), [item.args])

  if (!patchText) {
    return (
      <div className="text-xs text-gray-500">No apply_patch payload found in this FunctionCall.</div>
    )
  }

  const ops = parseApplyPatch(patchText)
  const [sel, setSel] = React.useState(0)
  const current = ops[sel]
  const sides = current ? parseUnifiedDiffToSides(current.unifiedDiff) : { original: '', modified: '' }

  // status (best-effort): look on this item.result.metadata if present
  const status = getStatus(item, pairedResultMeta)

  const [showRaw, setShowRaw] = React.useState(false)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <Badge variant="secondary">apply_patch</Badge>
        {typeof item.durationMs === 'number' && <span className="text-gray-400">{item.durationMs} ms</span>}
        {status && (
          <Badge variant={status.exitCode === 0 ? 'secondary' : 'destructive'}>
            {status.exitCode === 0 ? 'success' : `exit ${status.exitCode}`} {status.duration != null && `• ${status.duration}s`}
          </Badge>
        )}
        <span className="text-gray-400">files: {ops.length}</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowRaw((v) => !v)}>
            {showRaw ? 'Rendered' : 'Raw'}
          </Button>
        </div>
      </div>

      {ops.length > 1 && (
        <div className="flex gap-2 flex-wrap text-xs">
          {ops.map((op, i) => (
            <Button
              key={`${op.op}:${op.path}:${i}`}
              size="sm"
              variant={i === sel ? 'secondary' : 'outline'}
              onClick={() => setSel(i)}
            >
              {op.op.toUpperCase()} {op.path}
            </Button>
          ))}
        </div>
      )}

      {current && (
        showRaw ? (
          <pre className="text-xs bg-gray-50 rounded p-2 max-h-96 overflow-auto whitespace-pre">
{current.unifiedDiff}
          </pre>
        ) : (
          <DiffViewer
            path={current.path}
            original={sides.original}
            modified={sides.modified}
            language={guessLanguage(current.path)}
          />
        )
      )}
    </div>
  )
}

function getStatus(
  item: Extract<ResponseItem, { type: 'FunctionCall' }>,
  ext?: { exit_code?: number; exitCode?: number; duration_seconds?: number; durationSeconds?: number } | null,
) {
  const res: any = (item as any).result
  const meta = ext ?? res?.metadata ?? res?.meta
  if (!meta) return null
  const exitCode = meta.exit_code ?? meta.exitCode
  const duration = meta.duration_seconds ?? meta.durationSeconds
  if (exitCode == null && duration == null) return null
  return { exitCode: Number(exitCode ?? NaN), duration: typeof duration === 'number' ? duration : undefined }
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function guessLanguage(path: string): string | undefined {
  const lower = path.toLowerCase()
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript'
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript'
  if (lower.endsWith('.rs')) return 'rust'
  if (lower.endsWith('.py')) return 'python'
  if (lower.endsWith('.md')) return 'markdown'
  if (lower.endsWith('.json')) return 'json'
  return undefined
}
