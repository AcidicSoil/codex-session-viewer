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
    <div className={cn('text-sm', className)}>
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
        <div key={n.path}>
          <div
            ref={(el) => itemRefs.current.set(n.path, el)}
            className={cn(
              'flex items-center gap-1 py-0.5 px-1 rounded hover:bg-gray-50 cursor-pointer',
              selectedPath === n.path && 'bg-indigo-50 text-indigo-700',
            )}
            style={{ paddingLeft: 8 + depth * 14 }}
            onClick={() => {
              if (n.type === 'dir') {
                setExpanded((prev) => {
                  const next = new Set(prev)
                  if (next.has(n.path)) next.delete(n.path)
                  else next.add(n.path)
                  return next
                })
              } else {
                onSelect?.(n.path)
              }
            }}
          >
            {n.type === 'dir' ? (
              <>
                <Chevron open={expanded.has(n.path)} />
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
          {n.type === 'dir' && n.children && n.children.length > 0 && expanded.has(n.path) && (
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
          )}
        </div>
      ))}
    </div>
  )
}
