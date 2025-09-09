import { useEffect, useRef, useState } from 'react'
import { Disclosure } from '@headlessui/react'
import { streamTextLines } from './utils/lineReader'
import { useFileLoader } from './hooks/useFileLoader'
import FileInputButton from './components/FileInputButton'
import DropZone from './components/DropZone'
import MetadataPanel from './components/MetadataPanel'
import TimelineView from './components/TimelineView'
import CommandsView from './components/CommandsView'
import EventCard from './components/EventCard'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { ScrollArea } from './components/ui/scroll-area'
import { generateSyntheticEvents } from './utils/synthetic'
import { BookmarksProvider } from './state/bookmarks'
import { useBookmarks } from './state/bookmarks'
import { Button } from './components/ui/button'
import { eventKey } from './utils/eventKey'
import { parseHash, updateHash } from './utils/hashState'
import { exportJson, exportMarkdown, exportHtml, exportCsv, buildFilename } from './utils/exporters'
import type { ResponseItem } from './types'
import FileTree from './components/FileTree'
import FilePreview from './components/FilePreview'
import DiffViewer from './components/DiffViewer'
import { parseUnifiedDiffToSides } from './utils/diff'
import { getLanguageForPath } from './utils/language'
import useAutoDiscovery from './hooks/useAutoDiscovery'
import SessionsList from './components/SessionsList'
import { matchesEvent } from './utils/search'
import ExportModal from './components/ExportModal'
import ThemePicker from './components/ThemePicker'

function DevButtons({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
        disabled
        title="Load demo file (placeholder)"
      >
        Load demo file
      </button>
      <button
        className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
        onClick={onGenerate}
      >
        Generate 5k synthetic events
      </button>
    </div>
  )
}

export default function App() {
  return (
    <BookmarksProvider>
      <AppInner />
    </BookmarksProvider>
  )
}

function AppInner() {
  const [count, setCount] = useState(0)
  const [sampleLines, setSampleLines] = useState<string[]>([])
  const loader = useFileLoader()
  const { has, keys, clear } = useBookmarks()
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false)
  const hydratingRef = useRef(true)
  const [selectedFile, setSelectedFile] = useState<string | undefined>(undefined)
  const [activeDiff, setActiveDiff] = useState<
    | { path?: string; original: string; modified: string; language?: string }
    | undefined
  >(undefined)
  const [search, setSearch] = useState('')
  const [pathFilter, setPathFilter] = useState('')
  type TypeFilter = 'All' | 'Message' | 'Reasoning' | 'FunctionCall' | 'LocalShellCall' | 'WebSearchCall' | 'CustomToolCall' | 'FileChange' | 'Other' | 'ToolCalls'
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All')
  const [roleFilter, setRoleFilter] = useState<'All' | 'user' | 'assistant' | 'system'>('All')
  const [scrollToIndex, setScrollToIndex] = useState<number | null>(null)
  const [showOther, setShowOther] = useState(false)
  const { projectFiles, sessionAssets, isLoading, reload } = useAutoDiscovery()
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [showExport, setShowExport] = useState(false)

  function getFilteredItems(input?: { ev: any; key: string; absIndex: number }[]) {
    const full = input ?? loader.state.events.map((ev, i) => ({ ev, key: eventKey(ev as any, i), absIndex: i }))
    return full
      .filter(({ key }) => (showBookmarksOnly ? has(key) : true))
      .filter(({ ev }) => {
        if (typeFilter === 'All') return true
        const t = (ev as any).type
        if (typeFilter === 'ToolCalls') {
          return t === 'FunctionCall' || t === 'LocalShellCall' || t === 'WebSearchCall' || t === 'CustomToolCall'
        }
        if (typeFilter === 'Message') {
          if (t !== 'Message') return false
          if (roleFilter === 'All') return true
          const role = (ev as any).role
          return role === roleFilter
        }
        return t === typeFilter
      })
      .filter(({ ev }) => (typeFilter === 'All' && !showOther ? (ev as any).type !== 'Other' : true))
      .filter(({ ev }) => (search ? matchesEvent(ev as any, search) : true))
      .filter(({ ev }) => {
        const q = pathFilter.trim()
        if (!q) return true
        const anyEv: any = ev
        const p = (anyEv.path ? String(anyEv.path) : '').toLowerCase()
        const qq = q.toLowerCase()
        if (p.includes(qq)) return true
        return matchesEvent(anyEv, qq)
      })
  }

  async function handleFile(file: File) {
    setSampleLines([])
    // Preview first 10 lines for quick feedback
    let i = 0
    for await (const line of streamTextLines(file)) {
      setSampleLines((prev) => (prev.length < 10 ? [...prev, line] : prev))
      i++
      if (i >= 10) break
    }
    // Start parser streaming for progress/state
    loader.start(file)
  }

  // Hash → state (on load)
  useEffect(() => {
    const h = parseHash()
    const b = String(h.b || '').toLowerCase()
    setShowBookmarksOnly(b === '1' || b === 'true')
    if (h.f) setSelectedFile(h.f)
    if (h.q) setSearch(h.q)
    if ((h as any).pf) setPathFilter(String((h as any).pf))
    const o = String((h as any).o || '').toLowerCase()
    setShowOther(o === '1' || o === 'true')
    const validTypes = new Set(['All','Message','Reasoning','FunctionCall','LocalShellCall','WebSearchCall','CustomToolCall','FileChange','Other','ToolCalls'])
    if (h.t && validTypes.has(h.t)) setTypeFilter(h.t as any)
    const validRoles = new Set(['All','user','assistant','system'])
    if (h.r && validRoles.has(h.r)) setRoleFilter(h.r as any)
    hydratingRef.current = false
  }, [])

  // State → hash (on change)
  useEffect(() => {
    if (hydratingRef.current) return
    updateHash((prev) => {
      const next = { ...prev }
      if (showBookmarksOnly) next.b = '1'
      else delete next.b
      if (selectedFile) next.f = selectedFile
      else delete next.f
      if (typeFilter && typeFilter !== 'All') next.t = typeFilter
      else delete next.t
      if (roleFilter && roleFilter !== 'All') next.r = roleFilter
      else delete next.r
      if (search && search.trim()) next.q = search.trim()
      else delete next.q
      if (pathFilter && pathFilter.trim()) (next as any).pf = pathFilter.trim()
      else delete (next as any).pf
      if (showOther) (next as any).o = '1'
      else delete (next as any).o
      return next
    })
  }, [showBookmarksOnly, selectedFile, typeFilter, roleFilter, search, pathFilter, showOther])

  // Auto-open diff when a file is selected
  useEffect(() => {
    if (!selectedFile) {
      setActiveDiff(undefined)
      return
    }
    const events = loader.state.events ?? []
    for (let i = events.length - 1; i >= 0; i--) {
      const ev: any = events[i]
      if (ev.type === 'FileChange' && ev.path === selectedFile) {
        if (ev.diff) {
          try {
            const { original, modified } = parseUnifiedDiffToSides(ev.diff)
            setActiveDiff({
              path: selectedFile,
              original,
              modified,
              language: getLanguageForPath(selectedFile),
            })
          } catch {
            setActiveDiff({ path: selectedFile, original: '', modified: '', language: getLanguageForPath(selectedFile) })
          }
        } else {
          setActiveDiff({ path: selectedFile, original: '', modified: '', language: getLanguageForPath(selectedFile) })
        }
        return
      }
    }
    // No matching event; clear diff
    setActiveDiff({ path: selectedFile, original: '', modified: '', language: getLanguageForPath(selectedFile) })
  }, [selectedFile, loader.state.events])

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Codex Session Viewer</h1>
      <p className="text-gray-600">Vite + React + TS + Tailwind + Headless UI</p>
      <ThemePicker />

      <button
        className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 transition"
        onClick={() => setCount((c) => c + 1)}
      >
        Clicked {count} times
      </button>

      <Disclosure>
        {({ open }) => (
          <div className="space-y-2">
            <Disclosure.Button className="flex items-center gap-2 px-3 py-2 rounded bg-white shadow hover:shadow-md transition">
              <span>What is this app?</span>
              <span
                className="text-indigo-600 transition"
                style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                ▾
              </span>
            </Disclosure.Button>
            <Disclosure.Panel className="p-3 text-sm text-gray-700 bg-white rounded shadow space-y-2">
              <p>A viewer for Codex CLI sessions. Now includes streaming parser, metadata, and a virtualized timeline.</p>
              <DevButtons onGenerate={() => {
                loader.reset()
                const events = generateSyntheticEvents(5000)
                const meta = { id: `synthetic-${Date.now()}`, timestamp: new Date().toISOString(), version: 1, instructions: 'Synthetic dataset' } as any
                loader.ingest(events as any, meta)
              }} />
            </Disclosure.Panel>
          </div>
        )}
      </Disclosure>

      <div className="space-y-3 p-4 bg-white rounded shadow">
        <h2 className="font-medium">Open a session file</h2>
        <div className="flex items-center gap-3">
          <FileInputButton label="Choose .jsonl" onFile={handleFile} />
          <span className="text-gray-400">or</span>
          <div className="flex-1">
            <DropZone onFile={handleFile} />
          </div>
        </div>
        {sessionAssets.length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-gray-500 mb-1">Auto-detected sessions</div>
            <div className="flex flex-wrap gap-2 items-center">
              {sessionAssets.slice(0, 12).map((s, idx) => (
                <Button
                  key={s.path}
                  variant="outline"
                  size="sm"
                  title={s.path}
                  onClick={async () => {
                    const res = await fetch(s.url)
                    const blob = await res.blob()
                    const file = new File([blob], s.path, { type: 'text/plain' })
                    await handleFile(file)
                  }}
                >
                  {(idx + 1) + '. '} {s.path.split('/').slice(-1)[0]}
                </Button>
              ))}
              {sessionAssets.length > 12 && (
                <span className="text-xs text-gray-500 self-center">(+{sessionAssets.length - 12} more)</span>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowAllSessions((v) => !v)}>
                {showAllSessions ? 'Hide all' : `View all (${sessionAssets.length})`}
              </Button>
              <Button variant="outline" size="sm" onClick={() => reload()} disabled={isLoading}>
                {isLoading ? 'Reloading…' : 'Reload'}
              </Button>
              {isLoading && <span className="ml-2"><svg className="animate-spin h-4 w-4 text-gray-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg></span>}
            </div>
            {showAllSessions && (
              <div className="mt-2">
                <SessionsList
                  sessions={sessionAssets}
                  onSelect={async (s) => {
                    const res = await fetch(s.url)
                    const blob = await res.blob()
                    const file = new File([blob], s.path, { type: 'text/plain' })
                    await handleFile(file)
                    setShowAllSessions(false)
                  }}
                  onClose={() => setShowAllSessions(false)}
                  onReload={() => reload()}
                  loading={isLoading}
                />
              </div>
            )}
          </div>
        )}

        {loader.state.phase === 'parsing' && (
          <p className="text-sm text-indigo-700">Parsing… ok {loader.progress.ok}, errors {loader.progress.fail}</p>
        )}
        {loader.state.phase === 'success' && (
          <div className="text-sm text-green-700">
            <p className="font-medium">Parsed successfully</p>
            <pre className="bg-green-50 p-2 rounded overflow-auto">{JSON.stringify({ meta: loader.state.meta, ...loader.progress }, null, 2)}</pre>
          </div>
        )}
        {loader.state.fail > 0 && (
          <p className="text-sm text-red-600">Encountered {loader.state.fail} errors. Last: {loader.state.lastError?.message}</p>
        )}

        {sampleLines.length > 0 ? (
          <div className="text-sm space-y-2">
            <div>
              <p className="mb-1 text-gray-600">Preview (first 10 lines):</p>
              <pre className="bg-gray-50 p-2 rounded overflow-auto max-h-64">
{sampleLines.map((l, i) => (<div key={i}>{l}</div>))}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Select or drop a .jsonl file to preview lines.</p>
        )}
      </div>
      <MetadataPanel meta={loader.state.meta} />

      {((loader.state.events && loader.state.events.length > 0) || projectFiles.length > 0) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4">
                <div className="border rounded h-[30vh] md:h-[60vh] overflow-auto">
                  <FileTree
                    paths={(() => {
                      const eventPaths = (loader.state.events ?? [])
                        .filter((ev) => (ev as any).type === 'FileChange')
                        .map((ev) => (ev as any).path as string)
                      const all = new Set<string>(eventPaths)
                      for (const p of projectFiles) all.add(p)
                      return Array.from(all)
                    })()}
                    selectedPath={selectedFile}
                    onSelect={(p) => setSelectedFile(p)}
                  />
                </div>
              </div>
              <div className="md:col-span-8">
                {selectedFile && (
                  <div className="border rounded p-2 h-[30vh] md:h-[60vh] overflow-auto">
                    <FilePreview
                      path={selectedFile}
                      events={loader.state.events as any}
                      onOpenDiff={({ path, diff }) => {
                        if (!diff) {
                          setActiveDiff({ path, original: '', modified: '', language: getLanguageForPath(path) })
                          return
                        }
                        const { original, modified } = parseUnifiedDiffToSides(diff)
                        setActiveDiff({ path, original, modified, language: getLanguageForPath(path) })
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loader.state.events && loader.state.events.length > 0 && (
        <CommandsView
          events={loader.state.events as any}
          onJumpToIndex={(idx) => {
            setScrollToIndex(idx)
          }}
        />
      )}

      {loader.state.events && loader.state.events.length > 0 && (
        activeDiff && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Diff Viewer</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setActiveDiff(undefined)}>Close</Button>
            </CardHeader>
            <CardContent>
              <DiffViewer
                path={activeDiff.path}
                original={activeDiff.original}
                modified={activeDiff.modified}
                language={activeDiff.language}
                height={"60vh"}
              />
            </CardContent>
          </Card>
        )
      )}

      {loader.state.events && loader.state.events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(() => {
                const events = loader.state.events ?? []
                const typeCounts = {
                  All: events.length,
                  Message: events.filter((e) => (e as any).type === 'Message').length,
                  Reasoning: events.filter((e) => (e as any).type === 'Reasoning').length,
                  FunctionCall: events.filter((e) => (e as any).type === 'FunctionCall').length,
                  LocalShellCall: events.filter((e) => (e as any).type === 'LocalShellCall').length,
                  WebSearchCall: events.filter((e) => (e as any).type === 'WebSearchCall').length,
                  CustomToolCall: events.filter((e) => (e as any).type === 'CustomToolCall').length,
                  FileChange: events.filter((e) => (e as any).type === 'FileChange').length,
                  Other: events.filter((e) => (e as any).type === 'Other').length,
                }
                const toolCallsCount = typeCounts.FunctionCall + typeCounts.LocalShellCall + typeCounts.WebSearchCall + typeCounts.CustomToolCall
                const ROLE_OPTIONS: Array<'All' | 'user' | 'assistant' | 'system'> = ['All', 'user', 'assistant', 'system']
                const roleCounts = {
                  All: typeCounts.Message,
                  user: events.filter((e) => (e as any).type === 'Message' && (e as any).role === 'user').length,
                  assistant: events.filter((e) => (e as any).type === 'Message' && (e as any).role === 'assistant').length,
                  system: events.filter((e) => (e as any).type === 'Message' && (e as any).role === 'system').length,
                }
                const TYPE_OPTIONS: TypeFilter[] = ['All','Message','Reasoning','FunctionCall','LocalShellCall','WebSearchCall','CustomToolCall','FileChange','Other','ToolCalls']
                return (
                  <>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                      className="h-9 px-3 text-sm leading-5 border rounded-md bg-gray-800 border-gray-700 text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      aria-label="Filter by event type"
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t} disabled={t !== 'All' && t !== 'ToolCalls' ? (typeCounts as any)[t] === 0 : (t === 'ToolCalls' ? toolCallsCount === 0 : false)}>
                          {t === 'ToolCalls' ? `ToolCalls (${toolCallsCount})` : `${t} (${(typeCounts as any)[t] ?? 0})`}
                        </option>
                      ))}
                    </select>
                    <select
                      value={roleFilter}
                      onChange={(e) => {
                        const next = e.target.value as any
                        setRoleFilter(next)
                        // Ensure role filter is effective by switching to Message when needed
                        if (next !== 'All' && typeFilter !== 'Message') setTypeFilter('Message')
                      }}
                      className="h-9 px-3 text-sm leading-5 border rounded-md bg-gray-800 border-gray-700 text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      aria-label="Filter message role"
                      title={typeFilter !== 'Message' && roleFilter !== 'All' ? 'Role filter applies to Message events' : undefined}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r} disabled={r !== 'All' && roleCounts[r] === 0}>
                          {`${r} (${roleCounts[r]})`}
                        </option>
                      ))}
                    </select>
                  </>
                )
              })()}
              <input
                type="text"
                placeholder="Search events…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 px-3 text-sm leading-5 border rounded-md bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-400 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                aria-label="Search events"
              />
              <div className="relative">
                <details className="[&_summary::-webkit-details-marker]:hidden">
                  <summary className="h-9 px-3 text-sm leading-5 border rounded-md cursor-pointer select-none flex items-center gap-2 bg-gray-800 border-gray-700 text-gray-100 hover:bg-gray-700">
                    Advanced filters ▾
                  </summary>
                  <div className="absolute left-0 z-10 mt-1 w-[22rem] max-w-[90vw] rounded-md border bg-white shadow p-3">
                    <div className="mb-2 text-xs font-semibold text-gray-600">Advanced filters</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        placeholder="Path filter (e.g., src/ or app.tsx)"
                        value={pathFilter}
                        onChange={(e) => setPathFilter(e.target.value)}
                        className="h-9 px-3 text-sm leading-5 border rounded-md bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-400 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        aria-label="Filter by file path"
                      />
                      <Button
                        variant="outline"
                        size="default"
                        onClick={() => { if (selectedFile) setPathFilter(selectedFile) }}
                        disabled={!selectedFile}
                        title={selectedFile ? `Use selected file (${selectedFile})` : 'Select a file first'}
                      >
                        From selected
                      </Button>
                      <Button
                        variant={showOther ? 'secondary' : 'outline'}
                        size="default"
                        onClick={() => setShowOther((v) => !v)}
                        aria-pressed={showOther}
                        title={showOther ? 'Showing Other records' : 'Hiding Other records'}
                      >
                        {showOther ? 'Other: shown' : 'Other: hidden'}
                      </Button>
                    </div>
                  </div>
                </details>
              </div>
              <Button
                variant={showBookmarksOnly ? 'secondary' : 'outline'}
                size="default"
                onClick={() => setShowBookmarksOnly((v) => !v)}
              >
                {showBookmarksOnly ? 'Showing bookmarks' : `Bookmarks (${keys.length})`}
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={() => { setSearch(''); setPathFilter(''); setTypeFilter('All'); setRoleFilter('All'); setShowBookmarksOnly(false) }}
              >
                Clear filters
              </Button>
              {keys.length > 0 && (
                <Button variant="outline" size="default" onClick={() => clear()}>Clear</Button>
              )}
              <div className="relative">
                <details className="[&_summary::-webkit-details-marker]:hidden">
                  <summary
                    className={
                      `h-9 px-3 text-sm leading-5 rounded-md cursor-pointer select-none ${
                        loader.state.events.length ? 'bg-teal-600 text-white hover:bg-teal-500' : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      }`
                    }
                    aria-disabled={!loader.state.events.length}
                    onClick={(e) => {
                      e.preventDefault()
                      if (loader.state.events.length) setShowExport(true)
                    }}
                  >
                    Export…
                  </summary>
                </details>
              </div>
            </div>

            <ExportModal
              open={showExport}
              onClose={() => setShowExport(false)}
              meta={loader.state.meta as any}
              items={getFilteredItems().map(({ ev }) => ev as ResponseItem)}
              filters={{ type: typeFilter, role: roleFilter, q: search.trim() || undefined, pf: pathFilter.trim() || undefined, other: showOther || undefined }}
            />

            {(() => {
              const chips: Array<{ key: string; label: string; onClear: () => void }> = []
              if (typeFilter !== 'All') chips.push({ key: 'type', label: `type: ${typeFilter}` , onClear: () => setTypeFilter('All') })
              if (typeFilter === 'Message' && roleFilter !== 'All') chips.push({ key: 'role', label: `role: ${roleFilter}`, onClear: () => setRoleFilter('All') })
              if (search.trim()) chips.push({ key: 'search', label: `search: ${search.trim()}`, onClear: () => setSearch('') })
              if (pathFilter.trim()) chips.push({ key: 'path', label: `path: ${pathFilter.trim()}`, onClear: () => setPathFilter('') })
              if (showBookmarksOnly) chips.push({ key: 'bm', label: 'bookmarks', onClear: () => setShowBookmarksOnly(false) })
              if (chips.length === 0) return null
              return (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {chips.map((c) => (
                    <Badge key={c.key} variant="default" className="flex items-center gap-1">
                      <span>{c.label}</span>
                      <button
                        type="button"
                        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-gray-200"
                        aria-label={`Clear ${c.key}`}
                        onClick={c.onClear}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                  <Button
                    variant="outline"
                    size="default"
                    onClick={() => { setTypeFilter('All'); setRoleFilter('All'); setSearch(''); setPathFilter(''); setShowBookmarksOnly(false) }}
                  >
                    Clear all
                  </Button>
                </div>
              )
            })()}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh] md:h-[70vh]" viewportClassName="overflow-visible">
              {(() => {
                const full = loader.state.events.map((ev, i) => ({ ev, key: eventKey(ev as any, i), absIndex: i }))

                const filtered = getFilteredItems()
                return (
                  <TimelineView
                    items={filtered}
                    height={500}
                    estimateItemHeight={120}
                    keyForIndex={(it) => it.key}
                    scrollToIndex={scrollToIndex}
                    renderItem={(it) => (
                      <div className="mb-2">
                        <EventCard
                          item={it.ev as any}
                          index={it.absIndex}
                          bookmarkKey={it.key}
                          onRevealFile={(p) => setSelectedFile(p)}
                          highlight={search}
                          onOpenDiff={({ path, diff }) => {
                            if (!diff) {
                              setActiveDiff({ path, original: '', modified: '', language: getLanguageForPath(path) })
                              return
                            }
                            const { original, modified } = parseUnifiedDiffToSides(diff)
                            setActiveDiff({ path, original, modified, language: getLanguageForPath(path) })
                          }}
                        />
                      </div>
                    )}
                  />
                )
              })()}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
