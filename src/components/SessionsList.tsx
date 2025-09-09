import * as React from 'react'
import type { DiscoveredSessionAsset } from '../hooks/useAutoDiscovery'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'

export interface SessionsListProps {
  sessions: ReadonlyArray<DiscoveredSessionAsset>
  onSelect: (asset: DiscoveredSessionAsset) => Promise<void> | void
  onClose?: () => void
}

export default function SessionsList({ sessions, onSelect, onClose }: SessionsListProps) {
  const [q, setQ] = React.useState('')
  const [busy, setBusy] = React.useState<string | null>(null)

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = [...sessions]
    list.sort((a, b) => b.path.localeCompare(a.path))
    if (!t) return list
    return list.filter((s) => s.path.toLowerCase().includes(t))
  }, [sessions, q])

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

