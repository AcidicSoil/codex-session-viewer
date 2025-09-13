import * as React from 'react'
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
import CollapsibleCard from './components/ui/collapsible-card'
import { Badge } from './components/ui/badge'
import { ScrollArea } from './components/ui/scroll-area'
import { generateSyntheticEvents } from './utils/synthetic'
import { BookmarksProvider } from './state/bookmarks'
import ErrorBoundary from './components/ErrorBoundary'
import { useBookmarks } from './state/bookmarks'
import { Button } from './components/ui/button'
import { eventKey } from './utils/eventKey'
import { parseHash, updateHash } from './utils/hashState'
import { startFileSystemScanFromHandle } from './utils/fs-scanner'
import { listHashes, getSetting, setSetting, deleteSetting } from './utils/session-db'
import { buildChangeSet, type ChangeSet } from './scanner/diffIndex'
import { exportJson, exportMarkdown, exportHtml, exportCsv, buildFilename } from './utils/exporters'
import type { ResponseItem } from './types'
import FileTree from './components/FileTree'
import FilePreview from './components/FilePreview'
import DiffViewer from './components/DiffViewer'
import TwoFileDiff from './components/TwoFileDiff'
import { extractApplyPatchText } from './parsers/applyPatch'
import { parseUnifiedDiffToSides } from './utils/diff'
import { isApplyPatchFunction, passesFunctionNameFilter, sanitizeFnFilterList } from './utils/functionFilters'
import { getLanguageForPath } from './utils/language'
import useAutoDiscovery from './hooks/useAutoDiscovery'
import SessionsList from './components/SessionsList'
import { matchesEvent } from './utils/search'
import ExportModal from './components/ExportModal'
import ThemeDrawer from './components/ThemeDrawer'
import SessionLibrary from './components/SessionLibrary'
import { getWorkspaceDiff } from './scanner/diffProvider'
import { readFileText } from './utils/fs-io'
import { enumerateFiles, enumerateFilesInfo, type FileEntryInfo } from './utils/dir-enum'

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
      <ErrorBoundary name="App">
        <AppInner />
      </ErrorBoundary>
    </BookmarksProvider>
  )
}

function pairApplyPatchResultMeta(events: readonly any[], startIndex: number) {
  const start = events[startIndex]
  if (!start || (start as any).type !== 'FunctionCall') return null
  try {
    const args = (start as any).args
    const parsed = typeof args === 'string' ? JSON.parse(args) : args
    const isApply = parsed && Array.isArray(parsed.command) && parsed.command[0] === 'apply_patch'
    if (!isApply) return null
  } catch { return null }

  // Prefer status on the same event
  const metaSame = (start as any)?.result?.metadata ?? (start as any)?.result?.meta
  if (metaSame) return metaSame

  // Heuristic: look ahead a few events for a result-like FunctionCall with metadata
  for (let i = startIndex + 1; i < Math.min(events.length, startIndex + 6); i++) {
    const ev = events[i]
    if (!ev || ev.type !== 'FunctionCall') continue
    const meta = (ev as any)?.result?.metadata ?? (ev as any)?.result?.meta
    if (meta && (meta.exit_code != null || meta.exitCode != null)) return meta
  }
  return null
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
  // Dynamic FunctionCall name filter (e.g., 'shell', 'web.run', plus special 'apply_patch')
  const [fnFilter, setFnFilter] = useState<string[]>([])
  const { projectFiles, sessionAssets, isLoading, reload } = useAutoDiscovery()
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [showExport, setShowExport] = useState(false)
  // Removed: apply_patch-anywhere content filter (kept only diff-related filter via FunctionCall)
  // Chip-level bulk marking for auto-detected sessions
  const [chipScanQuery, setChipScanQuery] = useState('')
  const [chipMarks, setChipMarks] = useState<Record<string, boolean>>({})
  const [chipScanning, setChipScanning] = useState(false)
  const [chipProgress, setChipProgress] = useState(0)
  const [chipOnlyMatches, setChipOnlyMatches] = useState(false)
  const [workspace, setWorkspace] = useState<FileSystemDirectoryHandle | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progressPath, setProgressPath] = useState<string | null>(null)
  const [changeSet, setChangeSet] = useState<ChangeSet | null>(null)
  const [sessionsHandle, setSessionsHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [sessionsList, setSessionsList] = useState<FileEntryInfo[]>([])
  const [workspaceSessions, setWorkspaceSessions] = useState<FileEntryInfo[]>([])
  const [sessionsSort, setSessionsSort] = useState<'date-desc'|'date-asc'|'name-asc'|'name-desc'>('date-desc')
  const [sessionsFilterText, setSessionsFilterText] = useState('')
  const [sessionsMinKB, setSessionsMinKB] = useState('')
  const [sessionsMaxKB, setSessionsMaxKB] = useState('')
  const [changeMap, setChangeMap] = useState<Record<string, 'added' | 'modified' | 'deleted'>>({})
  const [autoDetect, setAutoDetect] = useState(true)
  const [showFileTree, setShowFileTree] = useState(false)
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([])
  const [logMismatchSet, setLogMismatchSet] = useState<Set<string>>(new Set())
  // Removed: generic file-edit filter toggle
  const [sessionKey, setSessionKey] = useState(0)
  const applyPatchCount = React.useMemo(() => {
    try { return (loader.state.events ?? []).filter((e: any) => isApplyPatchFunction(e)).length } catch { return 0 }
  }, [loader.state.events])

  function resetUIForNewSession() {
    try { clear() } catch {}
    setActiveDiff(undefined)
    setSelectedFile(undefined)
    setScrollToIndex(null)
    setSearch('')
    setPathFilter('')
    setTypeFilter('All')
    setRoleFilter('All')
    setShowOther(false)
    setFnFilter([])
    // Removed: apply_patch-anywhere and generic-file-edit toggles
    setShowAllSessions(false)
    setShowExport(false)
    setChipScanQuery('')
    setChipMarks({})
    setChipScanning(false)
    setChipProgress(0)
    setChipOnlyMatches(false)
    setSessionKey((k) => k + 1)
  }

  async function connectWorkspace() {
    try {
      // @ts-ignore experimental API
      const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker?.({ id: 'workspace', mode: 'read' })
      if (!handle) return
      // Reset UI and clear current session when switching workspace
      resetUIForNewSession()
      loader.reset()
      setWorkspace(handle)
      try { await setSetting('workspaceHandle', handle) } catch {}
      try { await refreshWorkspaceFiles(handle) } catch {}
    } catch {}
  }

  async function rescan() {
    if (!workspace) return
    const before = await listHashes()
    const runner = startFileSystemScanFromHandle(workspace)
    setScanning(true)
    const off = runner.onProgress((p) => setProgressPath(p))
    await new Promise<void>((resolve) => {
      const onMsg = (e: MessageEvent<any>) => {
        if (e.data === 'done' || e.data === 'aborted') {
          runner.worker.removeEventListener('message', onMsg as any)
          off()
          resolve()
        }
      }
      runner.worker.addEventListener('message', onMsg as any)
    })
    const after = await listHashes()
    const cs = buildChangeSet(before, after)
    setChangeSet(cs)
    setChangeMap(Object.fromEntries(cs.items.map((it) => [it.path, it.type])))
    try { await refreshWorkspaceFiles(workspace) } catch {}
    try { await refreshLogMismatches(workspace) } catch {}
    try { await refreshWorkspaceSessionsInfo(workspace) } catch { setWorkspaceSessions([]) }
    setScanning(false)
    setProgressPath(null)
  }

  async function refreshWorkspaceFiles(root: FileSystemDirectoryHandle) {
    // Only include files; directories are inferred in the tree
    const files = await enumerateFiles(root, (_p, isFile) => isFile)
    setWorkspaceFiles(files)
  }

  async function refreshWorkspaceSessionsInfo(root: FileSystemDirectoryHandle | null = workspace) {
    if (!root) { setWorkspaceSessions([]); return }
    const sess = await enumerateFilesInfo(root, (p, isFile) => isFile && /\.(jsonl|ndjson|json)$/i.test(p))
    setWorkspaceSessions(sess)
  }

  async function refreshLogMismatches(root: FileSystemDirectoryHandle | null) {
    if (!root) { setLogMismatchSet(new Set()); return }
    const events = loader.state.events ?? []
    const latest = new Map<string, string>()
    for (let i = events.length - 1; i >= 0; i--) {
      const ev: any = events[i]
      if (!ev || ev.type !== 'FileChange' || !ev.path || !ev.diff) continue
      const p = String(ev.path)
      if (latest.has(p)) continue
      try {
        const { modified } = parseUnifiedDiffToSides(ev.diff)
        latest.set(p, modified)
      } catch {}
    }
    const mismatches = new Set<string>()
    for (const [p, expected] of latest) {
      let actual = ''
      try { actual = await readFileText(root, p) } catch { actual = '' }
      if (actual !== expected) mismatches.add(p)
    }
    setLogMismatchSet(mismatches)
  }

  // Background auto-rescan (lightweight progress; avoids toggling global scanning UI)
  useEffect(() => {
    if (!workspace || !autoDetect) return
    let cancelled = false
    let timer: any = null
    let running = false
    async function tick() {
      if (cancelled || running) return
      running = true
      try {
        const before = await listHashes()
        const runner = startFileSystemScanFromHandle(workspace!)
        await new Promise<void>((resolve) => {
          const onMsg = (e: MessageEvent<any>) => {
            if (e.data === 'done' || e.data === 'aborted') {
              runner.worker.removeEventListener('message', onMsg as any)
              resolve()
            }
          }
          runner.worker.addEventListener('message', onMsg as any)
        })
        const after = await listHashes()
        const cs = buildChangeSet(before, after)
        if (!cancelled) {
          setChangeSet(cs)
          setChangeMap(Object.fromEntries(cs.items.map((it) => [it.path, it.type])))
          try { await refreshWorkspaceFiles(workspace!) } catch {}
          try { await refreshLogMismatches(workspace!) } catch {}
        }
      } catch {}
      finally {
        running = false
        if (!cancelled) timer = setTimeout(tick, 15000)
      }
    }
    // initial run and schedule
    tick()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [workspace, autoDetect])

  // Auto-restore workspace
  useEffect(() => {
    (async () => {
      try {
        const w = await getSetting<FileSystemDirectoryHandle>('workspaceHandle')
        if (w) {
          // @ts-ignore
          const state = await (w as any).queryPermission?.({ mode: 'read' })
          if (state === 'granted') { setWorkspace(w); try { await refreshWorkspaceFiles(w); await refreshLogMismatches(w) } catch {} }
        }
        try {
          const pref = await getSetting<boolean>('ui.showFileTree')
          if (typeof pref === 'boolean') setShowFileTree(pref)
        } catch {}
      } catch {}
    })()
  }, [])

  // Recompute mismatches when session events change
  useEffect(() => {
    (async () => { try { await refreshLogMismatches(workspace) } catch {} })()
  }, [loader.state.events, workspace])

  // UX: if all parsed events are "Other", auto-show them so timeline isn't empty
  useEffect(() => {
    try {
      const evs = loader.state.events ?? []
      if (evs.length > 0 && evs.every((e: any) => e?.type === 'Other')) {
        setShowOther(true)
      }
    } catch {}
  }, [loader.state.events])

  // Auto-connect to persisted .codex/sessions if permission remains granted
  useEffect(() => {
    (async () => {
      try {
        const h = await getSetting<FileSystemDirectoryHandle>('sessionsHandle')
        if (h) {
          // @ts-ignore experimental
          const state = await (h as any).queryPermission?.({ mode: 'read' })
          if (state === 'granted') {
            setSessionsHandle(h)
            await rescanSessions(h)
          }
        }
      } catch (e) {
        console.warn('sessionsHandle restore failed', e)
      }
    })()
  }, [])

  async function connectSessions() {
    try {
      // @ts-ignore experimental
      const dir: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker?.({ id: 'codex_sessions', mode: 'read' })
      if (!dir) return
      setSessionsHandle(dir)
      await setSetting('sessionsHandle', dir)
      await rescanSessions(dir)
    } catch (e) {
      console.warn('connectSessions cancelled or failed', e)
    }
  }

  async function rescanSessions(root: FileSystemDirectoryHandle | null = sessionsHandle) {
    if (!root) return
    setScanning(true)
    try {
      const { enumerateFilesInfo } = await import('./utils/dir-enum')
      const sess = await enumerateFilesInfo(root, (p, isFile) => isFile && /\.(jsonl|ndjson|json)$/i.test(p))
      setSessionsList(sess)
    } catch { setSessionsList([]) }
    finally {
      setScanning(false)
      setProgressPath(null)
    }
  }

  // Extract sortable date from a session path (best-effort)
  function parseSessionDate(p: string): number | null {
    const s = p.replace(/\\/g, '/');
    const m1 = s.match(/(\d{4})[\/_\-.](\d{2})[\/_\-.](\d{2})/)
    if (m1) {
      const y = Number(m1[1]), mo = Number(m1[2]) - 1, d = Number(m1[3])
      const t = Date.UTC(y, mo, d)
      return isNaN(t) ? null : t
    }
    const m2 = s.match(/(\d{4})(\d{2})(\d{2})/)
    if (m2) {
      const y = Number(m2[1]), mo = Number(m2[2]) - 1, d = Number(m2[3])
      const t = Date.UTC(y, mo, d)
      return isNaN(t) ? null : t
    }
    // Try ISO date prefix
    const m3 = s.match(/(\d{4}-\d{2}-\d{2}T[^_/]+)/)
    if (m3) { const iso = m3[1]!; const t = Date.parse(iso); return isNaN(t) ? null : t }
    return null
  }

  function sortSessions(list: FileEntryInfo[]): FileEntryInfo[] {
    const arr = [...list]
    const cmpName = (a: FileEntryInfo, b: FileEntryInfo) => a.path.localeCompare(b.path)
    const cmpDate = (a: FileEntryInfo, b: FileEntryInfo) => {
      const ta = parseSessionDate(a.path); const tb = parseSessionDate(b.path)
      if (ta != null && tb != null) return ta - tb
      if (ta != null) return -1
      if (tb != null) return 1
      return cmpName(a, b)
    }
    switch (sessionsSort) {
      case 'date-asc': arr.sort(cmpDate); break
      case 'date-desc': arr.sort((a,b) => -cmpDate(a,b)); break
      case 'name-desc': arr.sort((a,b) => -cmpName(a,b)); break
      default: arr.sort(cmpName)
    }
    return arr
  }

  function filterSessions(list: FileEntryInfo[]): FileEntryInfo[] {
    const q = sessionsFilterText.trim().toLowerCase()
    const min = Number(sessionsMinKB)
    const max = Number(sessionsMaxKB)
    return list.filter((item) => {
      const matchText = q ? item.path.toLowerCase().includes(q) : true
      const sizeKB = (item.size ?? 0) / 1024
      const matchMin = !Number.isFinite(min) || sessionsMinKB === '' ? true : sizeKB >= min
      const matchMax = !Number.isFinite(max) || sessionsMaxKB === '' ? true : sizeKB <= max
      return matchText && matchMin && matchMax
    })
  }

  const displayedSessions = React.useMemo(() => sortSessions(filterSessions(sessionsList)), [sessionsList, sessionsSort, sessionsFilterText, sessionsMinKB, sessionsMaxKB])
  const displayedWorkspaceSessions = React.useMemo(() => sortSessions(filterSessions(workspaceSessions)), [workspaceSessions, sessionsSort, sessionsFilterText, sessionsMinKB, sessionsMaxKB])

  async function loadFromHandle(root: FileSystemDirectoryHandle | null, path: string) {
    if (!root) return
    try {
      const parts = path.split('/').filter(Boolean)
      let dir: any = root
      for (let i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i]!)
      const fh = await dir.getFileHandle(parts[parts.length - 1]!)
      const file = await fh.getFile()
      await handleFile(file)
    } catch (e) {
      console.warn('loadFromHandle failed', e)
    }
  }

  async function openWorkspaceDiff(path: string) {
    if (!workspace) return
    try {
      const { original, modified } = await getWorkspaceDiff(workspace, path, loader.state.events as any)
      setActiveDiff({ path, original, modified, language: getLanguageForPath(path) })
    } catch {
      try {
        const after = await readFileText(workspace, path)
        setActiveDiff({ path, original: '', modified: after, language: getLanguageForPath(path) })
      } catch {}
    }
  }

  function safeMatches(ev: any, q: string) {
    try {
      return matchesEvent(ev, q)
    } catch (e) {
      console.warn('matchesEvent failed', e)
      return false
    }
  }

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
      // Removed: apply_patch-anywhere and generic file-edit filters
      // Function name filter (applies to FunctionCall; special 'apply_patch')
      .filter(({ ev }) => passesFunctionNameFilter(ev as any, fnFilter, typeFilter))
      .filter(({ ev }) => (search ? safeMatches(ev as any, search) : true))
      .filter(({ ev }) => {
        const q = pathFilter.trim()
        if (!q) return true
        const anyEv: any = ev
        const p = (anyEv.path ? String(anyEv.path) : '').toLowerCase()
        const qq = q.toLowerCase()
        if (p.includes(qq)) return true
        return safeMatches(anyEv, qq)
      })
      .filter(Boolean)
  }

  async function handleFile(file: File) {
    // Reset UI immediately when loading a new session file
    resetUIForNewSession()
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
    let h: any = {}
    try { h = parseHash() } catch (e) { console.warn('parseHash failed', e); h = {} }
    const b = String(h.b || '').toLowerCase()
    setShowBookmarksOnly(b === '1' || b === 'true')
    if (h.f) setSelectedFile(h.f)
    if (h.q) setSearch(h.q)
    if ((h as any).fn) setFnFilter(sanitizeFnFilterList(String((h as any).fn).split(',')))
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
      // Removed: apply_patch-anywhere and generic file-edit toggles in URL hash
      if (fnFilter && fnFilter.length) (next as any).fn = sanitizeFnFilterList(fnFilter).join(',')
      else delete (next as any).fn
      return next
    })
  }, [showBookmarksOnly, selectedFile, typeFilter, roleFilter, search, pathFilter, showOther, fnFilter])

  // Auto-open diff when a file is selected
  useEffect(() => {
    if (!selectedFile) {
      setActiveDiff(undefined)
      return
    }
    const events = loader.state.events ?? []
    let handled = false
    for (let i = events.length - 1; i >= 0; i--) {
      const ev: any = events[i]
      if (ev.type === 'FileChange' && ev.path === selectedFile) {
        if (ev.diff) {
          try {
            const { original, modified } = parseUnifiedDiffToSides(ev.diff)
            setActiveDiff({ path: selectedFile, original, modified, language: getLanguageForPath(selectedFile!) })
            handled = true
          } catch {
            // fall through to fallback below
          }
        }
        break // Found a matching FileChange; either showed diff or will fallback
      }
    }
    if (handled) return
    // Attempt workspace/apply_patch fallback if available
    ;(async () => {
      try {
        if (workspace) {
          const { original, modified } = await getWorkspaceDiff(workspace, selectedFile, events as any)
          setActiveDiff({ path: selectedFile, original, modified, language: getLanguageForPath(selectedFile!) })
          return
        }
      } catch {}
      setActiveDiff({ path: selectedFile, original: '', modified: '', language: getLanguageForPath(selectedFile!) })
    })()
  }, [selectedFile, loader.state.events, workspace])

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Codex Session Viewer</h1>
      {/* Appearance drawer with color picker */}
      <ThemeDrawer />

      <CollapsibleCard title="Workspace" defaultOpen>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={connectWorkspace}>Connect Workspace</Button>
          <Button variant="outline" size="sm" onClick={rescan} disabled={!workspace || scanning}>{scanning ? 'Scanning…' : 'Rescan'}</Button>
          <label className="ml-2 inline-flex items-center gap-1 text-sm">
            <input type="checkbox" checked={autoDetect} onChange={(e) => setAutoDetect(e.target.checked)} />
            <span>Auto-detect</span>
          </label>
          {workspace && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                // Full cleanup: reset UI state, detach file tree, clear workspace files
                try { resetUIForNewSession() } catch {}
                setShowFileTree(false)
                setWorkspaceFiles([])
                setWorkspace(null)
                setChangeSet(null)
                try { await setSetting('ui.showFileTree', false) } catch {}
                try { await deleteSetting('workspaceHandle') } catch {}
              }}
            >
              Disconnect
            </Button>
          )}
          {progressPath && <span className="text-xs opacity-70 truncate max-w-[40ch]">{progressPath}</span>}
          <span className="flex-1" />
          {!showFileTree ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => { setShowFileTree(true); try { await setSetting('ui.showFileTree', true) } catch {}; try { if (workspace) await refreshWorkspaceFiles(workspace) } catch {} }}
            >
              Add File Tree
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => { setShowFileTree(false); try { await setSetting('ui.showFileTree', false) } catch {} }}
            >
              Remove File Tree
            </Button>
          )}
        </div>
        <div className="text-sm">
      {changeSet ? (
        <div className="mt-2">
          <div className="mb-2">Added {changeSet.added} • Modified {changeSet.modified} • Deleted {changeSet.deleted}</div>
          <div className="mb-2 flex items-center gap-2 text-xs">
            <input
              className="border rounded px-1 py-0.5"
              placeholder="Filter sessions/files…"
              value={sessionsFilterText}
              onChange={(e) => setSessionsFilterText(e.target.value)}
              title="Filter by substring"
            />
            <input
              className="border rounded px-1 py-0.5 w-24"
              placeholder="Min KB"
              value={sessionsMinKB}
              onChange={(e) => setSessionsMinKB(e.target.value)}
              title="Minimum size in KB"
              inputMode="numeric"
            />
            <input
              className="border rounded px-1 py-0.5 w-24"
              placeholder="Max KB"
              value={sessionsMaxKB}
              onChange={(e) => setSessionsMaxKB(e.target.value)}
              title="Maximum size in KB"
              inputMode="numeric"
            />
            <select
              className="border rounded px-1 py-0.5"
              value={sessionsSort}
              onChange={(e) => setSessionsSort(e.target.value as any)}
              title="Sort order"
            >
              <option value="date-desc">Date (newest)</option>
              <option value="date-asc">Date (oldest)</option>
              <option value="name-asc">Name (A→Z)</option>
              <option value="name-desc">Name (Z→A)</option>
            </select>
          </div>
          <ul className="max-h-48 overflow-auto space-y-1">
            {displayedWorkspaceSessions.map((s) => (
              <li key={s.path} className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => loadFromHandle(workspace, s.path)}>Load</Button>
                <span className="truncate" title={s.path}>{s.path}</span>
                {typeof s.size === 'number' && <span className="text-xs text-gray-500">({Math.round((s.size/1024)*10)/10} KB)</span>}
              </li>
            ))}
          </ul>
          <div className="mt-3 font-medium">Changed Files</div>
          <ul className="max-h-48 overflow-auto space-y-1">
            {changeSet.items.map((it) => (
              <li key={it.path} className="flex items-center gap-2">
                <span className={`px-1 rounded text-white ${it.type === 'added' ? 'bg-green-600' : it.type === 'deleted' ? 'bg-red-600' : 'bg-amber-600'}`}>{it.type}</span>
                <Button variant="outline" size="sm" onClick={() => openWorkspaceDiff(it.path)}>Open diff</Button>
                <span className="truncate" title={it.path}>{it.path}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="opacity-70">Connect a workspace and run Rescan to see changes.</div>
      )}
        </div>
      </CollapsibleCard>

      <CollapsibleCard title=".codex/sessions" defaultOpen>
        <div className="flex items-center gap-3">
          {!sessionsHandle && (
            <Button variant="outline" size="sm" onClick={connectSessions}>Set .codex/sessions</Button>
          )}
          {sessionsHandle && (
            <>
              <Button variant="outline" size="sm" onClick={() => rescanSessions()}>Rescan Sessions</Button>
              <Button variant="outline" size="sm" onClick={async () => { await deleteSetting('sessionsHandle'); setSessionsHandle(null); setSessionsList([]) }}>Clear</Button>
              <Button variant="outline" size="sm" onClick={connectSessions}>Change Folder</Button>
            </>
          )}
          {progressPath && <span className="text-xs opacity-70 truncate max-w-[40ch]">{progressPath}</span>}
        </div>
        {sessionsHandle ? (
          <div className="text-sm">
            {sessionsList.length === 0 ? (
              <div className="opacity-70">No session files detected in this folder.</div>
            ) : (
              <>
              <div className="mb-2 flex items-center gap-2 text-xs">
                <input
                  className="border rounded px-1 py-0.5"
                  placeholder="Filter sessions…"
                  value={sessionsFilterText}
                  onChange={(e) => setSessionsFilterText(e.target.value)}
                  title="Filter by substring"
                />
                <input
                  className="border rounded px-1 py-0.5 w-24"
                  placeholder="Min KB"
                  value={sessionsMinKB}
                  onChange={(e) => setSessionsMinKB(e.target.value)}
                  title="Minimum size in KB"
                  inputMode="numeric"
                />
                <input
                  className="border rounded px-1 py-0.5 w-24"
                  placeholder="Max KB"
                  value={sessionsMaxKB}
                  onChange={(e) => setSessionsMaxKB(e.target.value)}
                  title="Maximum size in KB"
                  inputMode="numeric"
                />
                <select
                  className="border rounded px-1 py-0.5"
                  value={sessionsSort}
                  onChange={(e) => setSessionsSort(e.target.value as any)}
                  title="Sort order"
                >
                  <option value="date-desc">Date (newest)</option>
                  <option value="date-asc">Date (oldest)</option>
                  <option value="name-asc">Name (A→Z)</option>
                  <option value="name-desc">Name (Z→A)</option>
                </select>
              </div>
              <ul className="max-h-48 overflow-auto space-y-1">
                {displayedSessions.map((s) => (
                  <li key={s.path} className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => loadFromHandle(sessionsHandle, s.path)}>Load</Button>
                    <span className="truncate" title={s.path}>{s.path}</span>
                    {typeof s.size === 'number' && <span className="text-xs text-gray-500">({Math.round((s.size/1024)*10)/10} KB)</span>}
                  </li>
                ))}
              </ul>
              </>
            )}
          </div>
        ) : (
          <div className="text-sm opacity-70">Pick your .codex/sessions folder once to enable auto-connect on next visits.</div>
        )}
      </CollapsibleCard>

      <CollapsibleCard title="Open a session file" defaultOpen>
        <ErrorBoundary name="OpenSession">
          <div className="flex items-center gap-3">
            <FileInputButton label="Choose .jsonl" onFile={handleFile} />
            <span className="text-gray-400">or</span>
            <div className="flex-1">
              <DropZone onFile={handleFile} />
            </div>
          </div>
        </ErrorBoundary>
        {sessionAssets.length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-gray-500 mb-1">Auto-detected sessions</div>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Mark matches (e.g., apply_patch)"
                value={chipScanQuery}
                onChange={(e) => setChipScanQuery(e.target.value)}
                className="h-8 px-2 text-xs leading-5 border rounded-md bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-400 hover:bg-gray-700 focus:outline-none"
                title="Fetch and mark sessions whose content contains this text"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={chipScanning || !chipScanQuery.trim() || sessionAssets.length === 0}
                onClick={async () => {
                  const needle = chipScanQuery.trim().toLowerCase()
                  if (!needle) return
                  setChipScanning(true)
                  setChipProgress(0)
                  const next: Record<string, boolean> = {}
                  for (let i = 0; i < sessionAssets.length; i++) {
                    const s = sessionAssets[i]!
                    try {
                      const res = await fetch(s.url)
                      const text = await res.text()
                      const head = text.slice(0, 262144)
                      next[s.path] = head.toLowerCase().includes(needle)
                    } catch {
                      next[s.path] = false
                    } finally {
                      setChipProgress(Math.round(((i + 1) / sessionAssets.length) * 100))
                    }
                  }
                  setChipMarks(next)
                  setChipScanning(false)
                }}
                title="Scan and mark chips"
              >
                {chipScanning ? `Marking… ${chipProgress}%` : 'Mark matches'}
              </Button>
              <Button
                variant={chipOnlyMatches ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setChipOnlyMatches((v) => !v)}
                aria-pressed={chipOnlyMatches}
                title="Show only chips with a content match"
              >
                {chipOnlyMatches ? 'Chips: matches only' : 'Chips: show all'}
              </Button>
              {Object.keys(chipMarks).length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setChipMarks({})} title="Clear chip marks">Clear marks</Button>
              )}
              {(() => {
                // Build list reordered by matches first, optionally filter to matches
                let chipList = [...sessionAssets]
                if (Object.keys(chipMarks).length > 0) {
                  chipList.sort((a, b) => Number(Boolean(chipMarks[b.path])) - Number(Boolean(chipMarks[a.path])))
                }
                if (chipOnlyMatches) chipList = chipList.filter((s) => Boolean(chipMarks[s.path]))
                return chipList.slice(0, 12).map((s, idx) => { const item = s!; return (
                  <Button
                    key={item.path}
                    variant="outline"
                    size="sm"
                    title={item.path}
                    onClick={async () => {
                      const res = await fetch(item.url)
                      const blob = await res.blob()
                      const file = new File([blob], item.path, { type: 'text/plain' })
                      await handleFile(file)
                    }}
                  >
                  {(idx + 1) + '. '} {item.path.split('/').slice(-1)[0]} {chipMarks[item.path] && <span className="ml-1 text-emerald-600" title="Content match">●</span>}
                </Button>
                )})
              })()}
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
      </CollapsibleCard>
      <MetadataPanel meta={loader.state.meta} />
      {/* Session Library visible on welcome screen */}
      {(!loader.state.events || loader.state.events.length === 0) && (
        <CollapsibleCard title="Session Library" defaultOpen>
          <ErrorBoundary name="SessionLibrary">
            <SessionLibrary loader={loader} onWillLoad={resetUIForNewSession} />
          </ErrorBoundary>
        </CollapsibleCard>
      )}

      {(!loader.state.events || loader.state.events.length === 0) && (
        <CollapsibleCard title="Two‑File Diff" defaultOpen>
          <ErrorBoundary name="TwoFileDiff">
            <TwoFileDiff />
          </ErrorBoundary>
        </CollapsibleCard>
      )}

      {(
        (showFileTree && ((workspaceFiles.length > 0) || (loader.state.events && loader.state.events.length > 0) || projectFiles.length > 0))
        || Boolean(selectedFile)
      ) && (
        <CollapsibleCard title="Files" defaultOpen>
            <div key={`files-${sessionKey}`} className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {showFileTree && (
                <div className="md:col-span-4">
                  <div className="border rounded h-[30vh] md:h-[60vh] overflow-auto">
                    <FileTree
                      key={`tree-${sessionKey}`}
                      paths={(() => {
                        // Prefer actual workspace file list when available
                        if (workspace && workspaceFiles.length > 0) return workspaceFiles
                        const eventPaths = (loader.state.events ?? [])
                          .filter((ev) => (ev as any).type === 'FileChange')
                          .map((ev) => (ev as any).path as string)
                        const all = new Set<string>(eventPaths)
                        for (const p of projectFiles) all.add(p)
                        return Array.from(all)
                      })()}
                      selectedPath={selectedFile}
                      onSelect={(p) => setSelectedFile(p)}
                      changedFiles={changeMap}
                      logDiffs={logMismatchSet}
                    />
                  </div>
                </div>
              )}
              <div className={showFileTree ? "md:col-span-8" : "md:col-span-12"}>
                {selectedFile && (
                  <div className="border rounded p-2 h-[30vh] md:h-[60vh] overflow-auto">
                    <FilePreview
                      key={`preview-${sessionKey}-${selectedFile}`}
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
        </CollapsibleCard>
      )}

      {loader.state.events && loader.state.events.length > 0 && (
        <CommandsView
          key={`cmds-${sessionKey}`}
          events={loader.state.events as any}
          onJumpToIndex={(idx) => {
            setScrollToIndex(idx)
          }}
        />
      )}

      {loader.state.events && loader.state.events.length > 0 && (
        activeDiff && (
          <CollapsibleCard
            title="Diff Viewer"
            headerRight={<Button variant="outline" size="sm" onClick={() => setActiveDiff(undefined)}>Close</Button>}
            defaultOpen
          >
            <DiffViewer
              key={`diff-${sessionKey}-${activeDiff?.path ?? ''}`}
              path={activeDiff.path}
              original={activeDiff.original}
              modified={activeDiff.modified}
              language={activeDiff.language}
              height={"60vh"}
            />
          </CollapsibleCard>
        )
      )}

      {loader.state.events && loader.state.events.length > 0 && (
        <Card key={`timeline-${sessionKey}`}>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            {/* Sticky toolbar to keep controls visible while scrolling the page */}
            <div className="mt-2 flex flex-wrap items-center gap-2 sticky top-0 z-20 bg-gray-900/80 backdrop-blur supports-[backdrop-filter]:bg-gray-900/60 border-b border-gray-800 py-2 px-1 -mx-1">
              <ErrorBoundary name="Toolbar">
              {(() => {
                const events = loader.state.events ?? []
                let typeCounts: any = {
                  All: 0, Message: 0, Reasoning: 0, FunctionCall: 0, LocalShellCall: 0, WebSearchCall: 0, CustomToolCall: 0, FileChange: 0, Other: 0,
                }
                try {
                  typeCounts = {
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
                } catch (e) {
                  console.warn('typeCounts failed', e)
                }
                const toolCallsCount = typeCounts.FunctionCall + typeCounts.LocalShellCall + typeCounts.WebSearchCall + typeCounts.CustomToolCall
                const ROLE_OPTIONS: Array<'All' | 'user' | 'assistant' | 'system'> = ['All', 'user', 'assistant', 'system']
                let roleCounts = { All: typeCounts.Message, user: 0, assistant: 0, system: 0 }
                try {
                  roleCounts = {
                    All: typeCounts.Message,
                    user: events.filter((e) => (e as any).type === 'Message' && (e as any).role === 'user').length,
                    assistant: events.filter((e) => (e as any).type === 'Message' && (e as any).role === 'assistant').length,
                    system: events.filter((e) => (e as any).type === 'Message' && (e as any).role === 'system').length,
                  }
                } catch (e) {
                  console.warn('roleCounts failed', e)
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
                    { (typeFilter === 'FunctionCall' || typeFilter === 'ToolCalls') && (() => {
                      try {
                      // Derive function options with counts based on current search/path filters
                      const filteredForCounts = (loader.state.events as any[])
                        .filter((ev) => (typeFilter === 'FunctionCall' ? ev.type === 'FunctionCall' : true))
                        .filter((ev) => {
                          if (typeFilter === 'ToolCalls') {
                            // Only consider FunctionCall for function-name counts
                            return ev.type === 'FunctionCall'
                          }
                          return true
                        })
                        .filter((ev) => {
                          const q = pathFilter.trim()
                          if (!q) return true
                          const p = (ev as any).path ? String((ev as any).path).toLowerCase() : ''
                          const qq = q.toLowerCase()
                          if (p.includes(qq)) return true
                          return safeMatches(ev as any, qq)
                        })
                        .filter((ev) => (search ? safeMatches(ev as any, search) : true))

                      const nameCounts = new Map<string, number>()
                      let applyPatchCount = 0
                      for (const ev of filteredForCounts) {
                        if (ev.type !== 'FunctionCall') continue
                        const name = String(ev.name ?? 'unknown')
                        nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
                        if (isApplyPatchFunction(ev)) applyPatchCount++
                      }
                      const options = Array.from(nameCounts.entries()).sort((a,b) => b[1]-a[1])
                      const hasApply = applyPatchCount > 0
                      const otherOptions = options
                      return (
                        <div className="flex flex-wrap gap-2 items-center">
                          {/* Removed: generic file-edit filter toggle */}
                          <details className="relative">
                            <summary className="h-9 px-3 text-sm leading-5 rounded-md cursor-pointer select-none bg-gray-800 border border-gray-700 text-gray-100 hover:bg-gray-700">Function Calls ▾</summary>
                            <div className="absolute left-0 z-10 mt-1 w-[18rem] max-w-[95vw] rounded-md border bg-white shadow p-2">
                              <div className="text-xs font-semibold text-gray-600 mb-1">Select function calls</div>
                              <div className="max-h-64 overflow-auto pr-1">
                                {otherOptions.map(([name, cnt]) => (
                                  <label key={name} className="flex items-center gap-2 text-sm py-0.5">
                                    <input
                                      type="checkbox"
                                      checked={fnFilter.includes(name)}
                                      onChange={(e) => setFnFilter((prev) => e.target.checked ? [...prev, name] : prev.filter((v) => v !== name))}
                                    />
                                    <span className="flex-1 truncate" title={name}>{name}</span>
                                    <span className="text-xs text-gray-500">{cnt}</span>
                                  </label>
                                ))}
                              </div>
                              <div className="mt-2 flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setFnFilter([])}>Clear</Button>
                                <Button size="sm" variant="outline" onClick={() => setFnFilter(otherOptions.map(([n]) => n))}>All</Button>
                              </div>
                            </div>
                          </details>
                        </div>
                      )
                      } catch (e) {
                        console.warn('Function filter UI failed', e)
                        return (
                          <div className="text-xs text-amber-700">Function filters unavailable. <button className="underline" onClick={() => setFnFilter([])}>Clear</button></div>
                        )
                      }
                    })() }
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
              </ErrorBoundary>
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
                  <div className="absolute left-0 z-10 mt-1 w-[24rem] max-w-[95vw] rounded-md border bg-white shadow p-3">
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
              {/* Front-facing apply_patch FunctionCall filter */}
              <Button
                variant={fnFilter.includes('apply_patch') ? 'secondary' : 'outline'}
                size="default"
                onClick={() => setFnFilter((prev) => { const exists = prev.includes('apply_patch'); if (!exists) setTypeFilter('FunctionCall'); return exists ? prev.filter((v) => v !== 'apply_patch') : [...prev, 'apply_patch']; })}
                title="Filter: apply_patch FunctionCall events"
              >
                apply_patch ({applyPatchCount})
              </Button>
              {/* Removed: apply_patch-anywhere content filter button */}
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

            <ErrorBoundary name="ExportModal">
              <ExportModal
                open={showExport}
                onClose={() => setShowExport(false)}
                meta={loader.state.meta as any}
                items={(getFilteredItems() || []).map(({ ev }) => ev as ResponseItem)}
                filters={{ type: typeFilter, role: roleFilter, q: search.trim() || undefined, pf: pathFilter.trim() || undefined, other: showOther || undefined }}
              />
            </ErrorBoundary>

            {(() => {
              const chips: Array<{ key: string; label: string; onClear: () => void }> = []
              if (typeFilter !== 'All') chips.push({ key: 'type', label: `type: ${typeFilter}` , onClear: () => setTypeFilter('All') })
              if (typeFilter === 'Message' && roleFilter !== 'All') chips.push({ key: 'role', label: `role: ${roleFilter}`, onClear: () => setRoleFilter('All') })
              if (search.trim()) chips.push({ key: 'search', label: `search: ${search.trim()}`, onClear: () => setSearch('') })
              if (pathFilter.trim()) chips.push({ key: 'path', label: `path: ${pathFilter.trim()}`, onClear: () => setPathFilter('') })
              if (showBookmarksOnly) chips.push({ key: 'bm', label: 'bookmarks', onClear: () => setShowBookmarksOnly(false) })
              if (fnFilter.length) chips.push({ key: 'fn', label: `fn: ${fnFilter.join(',')}`, onClear: () => setFnFilter([]) })
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
                let full: { ev: any; key: string; absIndex: number }[] = []
                try {
                  full = (loader.state.events ?? []).map((ev, i) => ({ ev, key: eventKey(ev as any, i), absIndex: i }))
                } catch (e) {
                  console.warn('events mapping failed', e)
                  full = []
                }

                let filtered = full
                try { filtered = getFilteredItems(full) } catch (e) { console.warn('getFilteredItems failed', e); filtered = full }
                return (
                  <ErrorBoundary name="Timeline">
                    <TimelineView
                      items={filtered}
                      height={500}
                      estimateItemHeight={120}
                      keyForIndex={(it) => it.key}
                      scrollToIndex={scrollToIndex}
                      renderItem={(it) => (
                        <div className="mb-2">
                          <ErrorBoundary name="EventCard">
                            <EventCard
                              item={it.ev as any}
                              index={it.absIndex}
                              bookmarkKey={it.key}
                              onRevealFile={(p) => setSelectedFile(p)}
                              highlight={search}
                              applyPatchResultMeta={pairApplyPatchResultMeta(loader.state.events as any, it.absIndex)}
                              onOpenDiff={({ path, diff }) => {
                                try {
                                  if (!diff) {
                                    setActiveDiff({ path, original: '', modified: '', language: getLanguageForPath(path) })
                                    return
                                  }
                                  const { original, modified } = parseUnifiedDiffToSides(diff)
                                  setActiveDiff({ path, original, modified, language: getLanguageForPath(path) })
                                } catch (e) {
                                  console.warn('openDiff failed', e)
                                  setActiveDiff({ path, original: '', modified: '', language: getLanguageForPath(path) })
                                }
                              }}
                            />
                          </ErrorBoundary>
                        </div>
                      )}
                    />
                  </ErrorBoundary>
                )
              })()}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
