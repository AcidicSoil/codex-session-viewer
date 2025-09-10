import * as React from 'react'
import type { ResponseItem } from '../types'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { ClipboardIcon, StarFilledIcon, StarIcon } from './ui/icons'
import { useBookmarks } from '../state/bookmarks'
import { eventKey as computeEventKey } from '../utils/eventKey'
import { containsApplyPatchAnywhere } from '../utils/applyPatchHints'
import ApplyPatchView from './ApplyPatchView'

function formatAt(at?: string | number) {
  if (!at) return undefined
  try {
    const d = new Date(at)
    return isNaN(d.getTime()) ? String(at) : d.toLocaleString()
  } catch {
    return String(at)
  }
}

function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query) return <>{text}</>
  const q = query.trim()
  if (!q) return <>{text}</>
  const lower = text.toLowerCase()
  const target = q.toLowerCase()
  const parts: React.ReactNode[] = []
  let i = 0
  while (i < text.length) {
    const idx = lower.indexOf(target, i)
    if (idx === -1) {
      parts.push(text.slice(i))
      break
    }
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(<mark key={parts.length} className="bg-yellow-200 text-black">{text.slice(idx, idx + q.length)}</mark>)
    i = idx + q.length
  }
  return <>{parts}</>
}

function MessageEventView({ item, highlight }: { item: Extract<ResponseItem, { type: 'Message' }> ; highlight?: string }) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 flex flex-wrap gap-2 items-center">
        <Badge variant="secondary">{item.role}</Badge>
        {item.model && <span className="text-gray-400">{item.model}</span>}
      </div>
      <pre className="whitespace-pre-wrap break-words text-sm bg-gray-50 rounded p-2 max-h-64 overflow-auto">
        <Highlight text={item.content} query={highlight} />
      </pre>
    </div>
  )
}

function LocalShellCallView({ item, highlight }: { item: Extract<ResponseItem, { type: 'LocalShellCall' }>; highlight?: string }) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
        <code className="bg-gray-100 px-1.5 py-0.5 rounded"><Highlight text={item.command} query={highlight} /></code>
        {item.cwd && <span className="text-gray-400">cwd: {item.cwd}</span>}
        {typeof item.exitCode === 'number' && (
          <Badge variant={item.exitCode === 0 ? 'secondary' : 'destructive'}>
            exit {item.exitCode}
          </Badge>
        )}
        {item.durationMs && <span className="text-gray-400">{item.durationMs} ms</span>}
      </div>
      {item.stdout && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">stdout</div>
          <pre className="text-xs bg-gray-50 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap">
            <Highlight text={item.stdout} query={highlight} />
          </pre>
        </div>
      )}
      {item.stderr && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">stderr</div>
          <pre className="text-xs bg-red-50 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap">
            <Highlight text={item.stderr} query={highlight} />
          </pre>
        </div>
      )}
    </div>
  )
}

function FileChangeView({ item }: { item: Extract<ResponseItem, { type: 'FileChange' }> }) {
  const diff = item.diff
  let preview: string | undefined
  let notice: string | undefined
  if (diff) {
    // lightweight guards: avoid rendering huge or binary diffs inline
    const bytes = diff.length
    const lines = diff.split('\n').length
    const looksBinary = /\u0000/.test(diff) || /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(diff)
    const tooLarge = bytes > 200_000 || lines > 5000
    if (looksBinary) {
      notice = 'Binary-looking diff; hidden inline.'
    } else if (tooLarge) {
      notice = `Large diff (${Math.round(bytes/1024)} KB, ${lines} lines); showing first chunk.`
      preview = diff.split('\n').slice(0, 60).join('\n')
    } else {
      preview = diff.split('\n').slice(0, 60).join('\n')
    }
  }
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 flex items-center gap-2">
        <code className="bg-gray-100 px-1.5 py-0.5 rounded">{item.path}</code>
      </div>
      {preview && (
        <pre className="text-xs bg-gray-50 rounded p-2 max-h-64 overflow-auto">
{preview}
        </pre>
      )}
      {notice && <div className="text-xs text-amber-600">{notice}</div>}
      {!diff && <div className="text-xs text-gray-500">No diff attached.</div>}
    </div>
  )}

export interface EventCardProps {
  item: ResponseItem
  index?: number
  bookmarkKey?: string
  onRevealFile?: (path: string) => void
  highlight?: string
  applyPatchResultMeta?: { exit_code?: number; exitCode?: number; duration_seconds?: number; durationSeconds?: number } | null
}

function ReasoningEventView({ item }: { item: Extract<ResponseItem, { type: 'Reasoning' }> }) {
  return (
    <pre className="whitespace-pre-wrap break-words text-sm bg-gray-50 rounded p-2 max-h-64 overflow-auto">
      {item.content}
    </pre>
  )
}

function JsonBlock({ value, maxChars = 4000 }: { value: unknown; maxChars?: number }) {
  let text: string
  try {
    text = JSON.stringify(value, null, 2)
  } catch {
    text = String(value)
  }
  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + '\n…'
  }
  return (
    <pre className="text-xs bg-gray-50 rounded p-2 max-h-64 overflow-auto whitespace-pre-wrap">
      {text}
    </pre>
  )
}

function FunctionCallView({ item }: { item: Extract<ResponseItem, { type: 'FunctionCall' }> }) {
  const isApplyPatch = item.name === 'shell' && typeof (item as any).args !== 'undefined' && (() => {
    try {
      const a: any = (item as any).args
      const parsed = typeof a === 'string' ? JSON.parse(a) : a
      return parsed && Array.isArray(parsed.command) && parsed.command[0] === 'apply_patch'
    } catch { return false }
  })()

  if (isApplyPatch) {
    return <ApplyPatchView item={item} pairedResultMeta={(arguments as any)[0]?.applyPatchResultMeta ?? undefined} />
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{item.name}</Badge>
        {typeof item.durationMs === 'number' && <span className="text-gray-400">{item.durationMs} ms</span>}
      </div>
      {item.args !== undefined && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">args</div>
          <JsonBlock value={item.args} />
        </div>
      )}
      {item.result !== undefined && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">result</div>
          <JsonBlock value={item.result} />
        </div>
      )}
    </div>
  )
}

function WebSearchCallView({ item }: { item: Extract<ResponseItem, { type: 'WebSearchCall' }> }) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
        <span>query:</span>
        <code className="bg-gray-100 px-1.5 py-0.5 rounded">{item.query}</code>
        {item.provider && <Badge variant="secondary">{item.provider}</Badge>}
      </div>
      {item.results && item.results.length > 0 ? (
        <ul className="list-disc pl-5 space-y-1">
          {item.results.slice(0, 10).map((r, i) => (
            <li key={i} className="text-sm">
              {r.url ? (
                <a className="text-indigo-600 hover:underline" href={r.url} target="_blank" rel="noreferrer noopener">
                  {r.title || r.url}
                </a>
              ) : (
                <span className="text-gray-800">{r.title || 'Result'}</span>
              )}
              {r.snippet && <div className="text-xs text-gray-600">{r.snippet}</div>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-xs text-gray-500">No results.</div>
      )}
    </div>
  )
}

function CustomToolCallView({ item }: { item: Extract<ResponseItem, { type: 'CustomToolCall' }> }) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{item.toolName}</Badge>
      </div>
      {item.input !== undefined && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">input</div>
          <JsonBlock value={item.input} />
        </div>
      )}
      {item.output !== undefined && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">output</div>
          <JsonBlock value={item.output} />
        </div>
      )}
    </div>
  )
}

function eventKey(item: ResponseItem, index?: number) {
  const id = (item as any).id
  return String(id ?? (typeof index === 'number' ? `idx-${index}` : `${(item as any).type}-${Math.random()}`))
}

/**
 * Displays a single session event with optional bookmarking and metadata.
 * Non-essential controls like "Open diff" were removed for a cleaner UI,
 * leaving only the bookmark toggle and basic details.
 */
export default function EventCard({ item, index, bookmarkKey, onRevealFile, highlight, applyPatchResultMeta }: EventCardProps) {
  const { toggle, has } = useBookmarks()
  const key = bookmarkKey ?? computeEventKey(item, typeof index === 'number' ? index : 0)
  const at = 'at' in item ? (item as any).at : undefined
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3">
        <Badge>{(item as any).type ?? 'Event'}</Badge>
        {typeof index === 'number' && <div className="text-xs text-gray-500">#{index + 1}</div>}
        {at && <div className="text-xs text-gray-500">{formatAt(at)}</div>}
        {has(key) && <Badge variant="secondary">Bookmarked</Badge>}
        {containsApplyPatchAnywhere(item) && <Badge variant="outline" title="This event references apply_patch">✚ apply_patch</Badge>}
      </CardHeader>
      <CardContent>
        {item.type === 'Message' && <MessageEventView item={item} highlight={highlight} />}
        {item.type === 'LocalShellCall' && <LocalShellCallView item={item} highlight={highlight} />}
        {item.type === 'FileChange' && <FileChangeView item={item} />}
        {item.type === 'Reasoning' && <ReasoningEventView item={item} />}
        {item.type === 'FunctionCall' && <FunctionCallView item={item} />}
        {item.type === 'WebSearchCall' && <WebSearchCallView item={item} />}
        {item.type === 'CustomToolCall' && <CustomToolCallView item={item} />}

        {item.type !== 'Message' &&
          item.type !== 'LocalShellCall' &&
          item.type !== 'FileChange' && (
            <pre className="text-xs bg-gray-50 rounded p-2 overflow-auto">
{JSON.stringify(item as any, null, 2)}
            </pre>
          )}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {/* Removed per spec: reveal/open/copy buttons trimmed for cleaner UI */}
        <Button
          variant={has(key) ? 'secondary' : 'outline'}
          size="icon"
          onClick={() => toggle(key)}
          aria-pressed={has(key)}
          aria-label={has(key) ? 'Remove bookmark' : 'Add bookmark'}
          title={has(key) ? 'Remove bookmark' : 'Add bookmark'}
        >
          {has(key) ? <StarFilledIcon /> : <StarIcon />}
          <span className="sr-only">{has(key) ? 'Remove bookmark' : 'Add bookmark'}</span>
        </Button>
      </CardFooter>
    </Card>
  )
}
