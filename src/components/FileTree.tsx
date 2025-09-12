import * as React from 'react'
import { buildFileTree, type FileTreeNode, ancestorDirs } from '../utils/fileTree'
import { cn } from '../utils/cn'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('h-3 w-3 transition-transform', open ? 'rotate-90' : 'rotate-0')}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M7 5l6 5-6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}

export interface FileTreeProps {
  paths: readonly string[]
  selectedPath?: string
  onSelect?: (path: string) => void
  className?: string
  // Map of path -> change type ('added' | 'modified' | 'deleted')
  changes?: Readonly<Record<string, 'added' | 'modified' | 'deleted'>>
  // Set of paths that have session log diffs
  logDiffs?: ReadonlySet<string>
}

export default function FileTree({ paths, selectedPath, onSelect, className, changes, logDiffs }: FileTreeProps) {
  const tree = React.useMemo(() => buildFileTree(Array.from(new Set(paths))), [paths])
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())
  const itemRefs = React.useRef(new Map<string, HTMLDivElement | null>())
  const changeKeys = React.useMemo(() => new Set(Object.keys(changes || {})), [changes])
  const logSet = React.useMemo(() => logDiffs ?? new Set<string>(), [logDiffs])
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)

  // Ensure Preline TreeView auto-initializes in SPA mounts
  React.useEffect(() => {
    // Initialize Preline instance for this wrapper and clean up on unmount
    let cleanup: (() => void) | undefined
    try {
      // @ts-ignore - provided by @preline/tree-view UMD
      const API = (typeof window !== 'undefined') ? (window as any).HSTreeView : undefined
      if (API?.autoInit) {
        // Allow React to paint first
        const t = setTimeout(() => {
          try {
            API.autoInit()
            if (wrapperRef.current) {
              const instWrap = API.getInstance(wrapperRef.current, true)
              const inst = instWrap?.element
              try { inst?.update?.() } catch {}
              // Wire Preline click -> our expand/select behavior
              try {
                inst?.on?.('click', ({ data }: any) => {
                  if (!data) return
                  if (data.isDir) {
                    setExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(data.path)) next.delete(data.path)
                      else next.add(data.path)
                      return next
                    })
                  } else {
                    onSelect?.(data.path)
                  }
                })
              } catch {}
              cleanup = () => { try { inst?.destroy?.() } catch {} }
            }
          } catch {}
        }, 0)
        return () => { clearTimeout(t); try { cleanup?.() } catch {} }
      }
    } catch {}
  }, [tree, onSelect])

  // Expand ancestors and scroll selected into view when selection changes
  React.useEffect(() => {
    if (!selectedPath) return
    setExpanded((prev) => {
      const next = new Set(prev)
      for (const anc of ancestorDirs(selectedPath)) next.add(anc)
      return next
    })
    const el = itemRefs.current.get(selectedPath)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [selectedPath])

  return (
    <div
      ref={wrapperRef}
      className={cn('text-sm', className)}
      data-hs-tree-view
    >
      <div className="hs-tree-view [--hs-tree-view-item-indent-size:1rem]">
        <TreeNodes
          nodes={tree}
          depth={0}
          expanded={expanded}
          setExpanded={setExpanded}
          selectedPath={selectedPath}
          onSelect={onSelect}
          itemRefs={itemRefs}
          changes={changes}
          changeKeys={changeKeys}
          logDiffs={logSet}
        />
      </div>
    </div>
  )
}

function TreeNodes({
  nodes,
  depth,
  expanded,
  setExpanded,
  selectedPath,
  onSelect,
  itemRefs,
  changes,
  changeKeys,
  logDiffs,
}: {
  nodes: FileTreeNode[]
  depth: number
  expanded: Set<string>
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>
  selectedPath?: string
  onSelect?: (path: string) => void
  itemRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>
  changes?: Readonly<Record<string, 'added' | 'modified' | 'deleted'>>
  changeKeys: Set<string>
  logDiffs: ReadonlySet<string>
}) {
  function dirChangeType(path: string): 'added' | 'modified' | 'deleted' | undefined {
    // Determine folder badge by scanning descendant changed items (simple, efficient for small sets)
    let hasAdded = false, hasModified = false, hasDeleted = false
    const prefix = path ? path + '/' : ''
    for (const k of changeKeys) {
      if (k === path || k.startsWith(prefix)) {
        const t = changes?.[k]
        if (t === 'deleted') hasDeleted = true
        else if (t === 'added') hasAdded = true
        else if (t === 'modified') hasModified = true
        if (hasDeleted) return 'deleted'
      }
    }
    if (hasAdded) return 'added'
    if (hasModified) return 'modified'
    return undefined
  }

  function ChangeDot({ type }: { type?: 'added' | 'modified' | 'deleted' }) {
    if (!type) return null
    const color = type === 'added' ? 'bg-green-600' : type === 'deleted' ? 'bg-red-600' : 'bg-amber-600'
    const label = type
    return (
      <span
        className={`ml-1 inline-block h-2 w-2 rounded-full ${color}`}
        title={label}
        aria-label={label}
      />
    )
  }

  function dirHasLogDiff(path: string): boolean {
    const prefix = path ? path + '/' : ''
    for (const p of logDiffs) {
      if (p === path || p.startsWith(prefix)) return true
    }
    return false
  }

  function LogToast({ show }: { show: boolean }) {
    if (!show) return null
    return (
      <span className="ml-1 inline-block px-1 text-[10px] leading-4 rounded bg-indigo-600 text-white" title="Has session diffs" aria-label="Has session diffs">diff</span>
    )
  }

  return (
    <div className="select-none">
      {nodes.map((n) => (
        <div
          key={n.path}
          data-hs-tree-view-item={JSON.stringify({ value: n.name, isDir: n.type === 'dir' })}
          className="hs-tree-view-item"
        >
          <div
            ref={(el) => itemRefs.current.set(n.path, el)}
            className={cn(
              'flex items-center gap-1 py-1 px-1 rounded hover:bg-gray-50 cursor-pointer [&.selected]:bg-primary/10 [&.selected]:text-primary',
              selectedPath === n.path && 'bg-primary/10 text-primary',
            )}
            style={{ paddingLeft: 8 + depth * 16 }}
            aria-expanded={n.type === 'dir' ? expanded.has(n.path) : undefined}
            role="treeitem"
          >
            {n.type === 'dir' ? (
              <>
                <button
                  type="button"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(n.path)) next.delete(n.path)
                      else next.add(n.path)
                      return next
                    })
                  }}
                  title={expanded.has(n.path) ? 'Collapse' : 'Expand'}
                  aria-label={expanded.has(n.path) ? 'Collapse' : 'Expand'}
                >
                  <Chevron open={expanded.has(n.path)} />
                </button>
                <FolderIcon />
                <span className="font-medium">{n.name}</span>
                <ChangeDot type={dirChangeType(n.path)} />
                <LogToast show={dirHasLogDiff(n.path)} />
              </>
            ) : (
              <>
                <span className="w-3" />
                <FileIcon />
                <span className="truncate">{n.name}</span>
                <ChangeDot type={changes?.[n.path]} />
                <LogToast show={logDiffs.has(n.path)} />
              </>
            )}
          </div>
          {n.type === 'dir' && n.children && n.children.length > 0 && (
            <div role="group" className={expanded.has(n.path) ? 'block' : 'hidden'}>
              <TreeNodes
                nodes={n.children}
                depth={depth + 1}
                expanded={expanded}
                setExpanded={setExpanded}
                selectedPath={selectedPath}
                onSelect={onSelect}
                itemRefs={itemRefs}
                changes={changes}
                changeKeys={changeKeys}
                logDiffs={logDiffs}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
