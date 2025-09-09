import * as React from 'react'
import type { DiscoveredSessionAsset } from '../hooks/useAutoDiscovery'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { parseTimestampFromPath } from '../utils/timestamp'

export interface SessionsListProps {
  sessions: ReadonlyArray<DiscoveredSessionAsset>
  onSelect: (asset: DiscoveredSessionAsset) => Promise<void> | void
  onClose?: () => void
  onReload?: () => void
  loading?: boolean
}

export default function SessionsList({ sessions, onSelect, onClose, onReload, loading }: SessionsListProps) {
  const [q, setQ] = React.useState('')
  const [busy, setBusy] = React.useState<string | null>(null)
  const [sort, setSort] = React.useState<'Newest' | 'Name'>('Newest')

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase()
    let list = [...sessions]
    if (sort === 'Newest') {
      list.sort((a, b) => (parseTimestampFromPath(b.path) ?? 0) - (parseTimestampFromPath(a.path) ?? 0) || b.path.localeCompare(a.path))
    } else {
      list.sort((a, b) => a.path.localeCompare(b.path))
    }
    if (!t) return list
    return list.filter((s) => s.path.toLowerCase().includes(t))
  }, [sessions, q, sort])

  async function handleLoad(asset: DiscoveredSessionAsset) {
    try {
      setBusy(asset.path)
      await onSelect(asset)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>All Sessions ({filtered.length}/{sessions.length})</CardTitle>
        <div className="flex gap-2 items-center">
          {onReload && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onReload} disabled={!!loading}>
                {loading ? 'Reloading…' : 'Reload'}
              </Button>
              {loading && (
                <svg className="animate-spin h-4 w-4 text-gray-500" viewBox="0 0 24 24" aria-label="Loading">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
            </div>
          )}
          <select
            className="h-9 px-2 text-sm leading-5 border rounded-md bg-gray-800 border-gray-700 text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            title="Sort order"
          >
            <option value="Newest">Newest</option>
            <option value="Name">Name</option>
          </select>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by path…"
            className="h-9 px-3 text-sm leading-5 border rounded-md bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-400 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 w-64"
          />
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-sm text-gray-500">No discovered sessions found.</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-gray-500">No sessions match your search.</div>
        ) : (
          <div className="max-h-[50vh] overflow-auto divide-y">
            {filtered.map((s) => (
              <div key={s.path} className="py-2 flex items-center gap-2 justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate" title={s.path}>{s.path}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard?.writeText(s.path)}
                    title="Copy path"
                  >
                    Copy
                  </Button>
                  <a href={s.url} target="_blank" rel="noreferrer noopener">
                    <Button variant="outline" size="sm" title="Open raw file">Raw</Button>
                  </a>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleLoad(s)}
                    disabled={busy !== null}
                    title="Load into viewer"
                  >
                    {busy === s.path ? 'Loading…' : 'Load'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

