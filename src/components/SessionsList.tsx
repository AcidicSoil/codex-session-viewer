import * as React from 'react'
import type { DiscoveredSessionAsset } from '../hooks/useAutoDiscovery'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { parseTimestampFromPath } from '../utils/timestamp'
import { fetchCwdTagsFromUrl } from '../utils/session-tags'

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
  const [scanQuery, setScanQuery] = React.useState('')
  const [onlyMatches, setOnlyMatches] = React.useState(false)
  const [marks, setMarks] = React.useState<Record<string, boolean>>({})
  const [scanning, setScanning] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [tagMap, setTagMap] = React.useState<Record<string, readonly string[]>>({})
  const [tagErrors, setTagErrors] = React.useState<Record<string, boolean>>({})
  const [loadingTags, setLoadingTags] = React.useState<Record<string, boolean>>({})

  const tagMapRef = React.useRef(tagMap)
  const tagErrorRef = React.useRef(tagErrors)
  const loadingTagsRef = React.useRef(loadingTags)

  React.useEffect(() => { tagMapRef.current = tagMap }, [tagMap])
  React.useEffect(() => { tagErrorRef.current = tagErrors }, [tagErrors])
  React.useEffect(() => { loadingTagsRef.current = loadingTags }, [loadingTags])

  React.useEffect(() => {
    if (sessions.length === 0) return
    const next: Record<string, readonly string[]> = {}
    for (const item of sessions) {
      if (Array.isArray(item.tags)) {
        next[item.path] = item.tags
      }
    }
    if (Object.keys(next).length === 0) return
    setTagMap((prev) => {
      const merged = { ...prev }
      let changed = false
      for (const [path, tags] of Object.entries(next)) {
        if (!merged[path]) {
          merged[path] = tags
          changed = true
        }
      }
      if (!changed) return prev
      return merged
    })
  }, [sessions])

  React.useEffect(() => {
    let active = true
    const controllers: AbortController[] = []
    const pending = sessions.filter((s) => !tagMapRef.current[s.path] && !loadingTagsRef.current[s.path])
    if (pending.length === 0) return

    ;(async () => {
      for (const asset of pending) {
        if (!active) break
        const controller = new AbortController()
        controllers.push(controller)
        setLoadingTags((prev) => {
          if (!active) return prev
          const next = { ...prev, [asset.path]: true }
          loadingTagsRef.current = next
          return next
        })
        try {
          const tags = await fetchCwdTagsFromUrl(asset.url, { signal: controller.signal })
          if (!active || controller.signal.aborted) continue
          setTagErrors((prev) => {
            if (!active || !prev[asset.path]) return prev
            const next = { ...prev }
            delete next[asset.path]
            tagErrorRef.current = next
            return next
          })
          setTagMap((prev) => {
            if (!active) return prev
            const next = { ...prev, [asset.path]: tags }
            tagMapRef.current = next
            return next
          })
        } catch (error) {
          if (!active || controller.signal.aborted) continue
          setTagErrors((prev) => {
            if (!active) return prev
            const next = { ...prev, [asset.path]: true }
            tagErrorRef.current = next
            return next
          })
          setTagMap((prev) => {
            if (!active) return prev
            const next = { ...prev, [asset.path]: [] }
            tagMapRef.current = next
            return next
          })
        } finally {
          setLoadingTags((prev) => {
            if (!active) return prev
            const next = { ...prev }
            delete next[asset.path]
            loadingTagsRef.current = next
            return next
          })
        }
      }
    })()

    return () => {
      active = false
      for (const controller of controllers) controller.abort()
    }
  }, [sessions])

  const filtered = React.useMemo(() => {
    const t = q.trim().toLowerCase()
    let list = [...sessions]
    if (sort === 'Newest') {
      list.sort((a, b) => (parseTimestampFromPath(b.path) ?? 0) - (parseTimestampFromPath(a.path) ?? 0) || b.path.localeCompare(a.path))
    } else {
      list.sort((a, b) => a.path.localeCompare(b.path))
    }
    // group matched sessions first when marks exist
    if (Object.keys(marks).length > 0) {
      list.sort((a, b) => Number(Boolean(marks[b.path])) - Number(Boolean(marks[a.path])))
    }
    // path search
    const byPath = t ? list.filter((s) => s!.path.toLowerCase().includes(t)) : list
    // content match filtering
    return onlyMatches ? byPath.filter((s) => Boolean(marks[s!.path])) : byPath
  }, [sessions, q, sort, marks, onlyMatches])

  async function handleLoad(asset: DiscoveredSessionAsset) {
    try {
      setBusy(asset.path)
      await onSelect(asset)
    } finally {
      setBusy(null)
    }
  }

  async function scanAllSessions(query: string) {
    const needle = query.trim().toLowerCase()
    if (!needle) return
    setScanning(true)
    setProgress(0)
    const next: Record<string, boolean> = {}
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i]!
      try {
        const res = await fetch(s.url)
        const text = await res.text()
        const head = text.slice(0, 262144) // scan first 256KB
        next[s.path] = head.toLowerCase().includes(needle)
      } catch (e) {
        next[s.path] = false
      } finally {
        setProgress(Math.round(((i + 1) / sessions.length) * 100))
      }
    }
    setMarks(next)
    setScanning(false)
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
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={scanQuery}
              onChange={(e) => setScanQuery(e.target.value)}
              placeholder="Content filter (e.g., apply_patch)"
              className="h-9 px-3 text-sm leading-5 border rounded-md bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-400 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 w-56"
              title="Fetch sessions and mark those whose content contains this text"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={scanning || !scanQuery.trim() || sessions.length === 0}
              onClick={() => scanAllSessions(scanQuery)}
              title="Scan session files for content matches"
            >
              {scanning ? `Scanning… ${progress}%` : 'Scan'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setScanQuery('apply_patch'); scanAllSessions('apply_patch') }}
              disabled={scanning || sessions.length === 0}
              title="Scan for apply_patch occurrences"
            >
              Scan apply_patch
            </Button>
            <Button
              variant={onlyMatches ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setOnlyMatches((v) => !v)}
              aria-pressed={onlyMatches}
              title="Show only sessions that matched the content filter"
            >
              {onlyMatches ? 'Matches only' : 'Show all'}
            </Button>
            {Object.keys(marks).length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setMarks({})} title="Clear markers">Clear marks</Button>
            )}
          </div>
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
        ) : (() => {
          const hasMarks = Object.keys(marks).length > 0
          if (!hasMarks) {
            return (
              <div className="max-h-[50vh] overflow-auto divide-y">
                {filtered.map((s) => (
                  <Row
                    key={s.path}
                    s={s}
                    mark={Boolean(marks[s.path])}
                    busy={busy}
                    onLoad={handleLoad}
                    tags={tagMap[s.path]}
                    tagsLoading={Boolean(loadingTags[s.path])}
                    tagsErrored={Boolean(tagErrors[s.path])}
                  />
                ))}
              </div>
            )
          }
          const matches = filtered.filter((s) => marks[s.path])
          const others = filtered.filter((s) => !marks[s.path])
          return (
            <div className="max-h-[50vh] overflow-auto">
              {matches.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 sticky top-0">Matches ({matches.length})</div>
                  <div className="divide-y">
                    {matches.map((s) => (
                      <Row
                        key={s.path}
                        s={s}
                        mark={true}
                        busy={busy}
                        onLoad={handleLoad}
                        tags={tagMap[s.path]}
                        tagsLoading={Boolean(loadingTags[s.path])}
                        tagsErrored={Boolean(tagErrors[s.path])}
                      />
                    ))}
                  </div>
                </div>
              )}
              {others.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-50 sticky top-0">Others ({others.length})</div>
                  <div className="divide-y">
                    {others.map((s) => (
                      <Row
                        key={s.path}
                        s={s}
                        mark={false}
                        busy={busy}
                        onLoad={handleLoad}
                        tags={tagMap[s.path]}
                        tagsLoading={Boolean(loadingTags[s.path])}
                        tagsErrored={Boolean(tagErrors[s.path])}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </CardContent>
    </Card>
  )
}

function Row({
  s,
  mark,
  busy,
  onLoad,
  tags,
  tagsLoading,
  tagsErrored,
}: {
  s: DiscoveredSessionAsset
  mark: boolean
  busy: string | null
  onLoad: (s: DiscoveredSessionAsset) => void
  tags?: readonly string[]
  tagsLoading: boolean
  tagsErrored: boolean
}) {
  const hasTags = Boolean(tags && tags.length > 0)
  return (
    <div className="py-2 flex items-center gap-2 justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center flex-wrap gap-1">
          <span className="min-w-0 truncate text-sm" title={s.path}>
            {s.path}
          </span>
          {mark && <span title="Content match" className="text-emerald-600">●</span>}
          {(tagsLoading || tagsErrored || hasTags) && (
            <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-gray-500">
              {tagsLoading ? (
                <span>Loading tags…</span>
              ) : tagsErrored ? (
                <span className="text-red-500">Tags unavailable</span>
              ) : (
                tags?.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    title={tag}
                    className="max-w-[16rem] overflow-hidden text-ellipsis whitespace-nowrap"
                  >
                    {tag}
                  </Badge>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {/* Removed: Copy path / Raw buttons */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onLoad(s)}
          disabled={busy !== null}
          title="Load into viewer"
        >
          {busy === s.path ? 'Loading…' : 'Load'}
        </Button>
      </div>
    </div>
  )
}
