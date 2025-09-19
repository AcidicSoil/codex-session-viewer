import * as React from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { createTwoFilesPatch } from 'diff'
import { Diff2Html } from 'diff2html'
import DiffView from './DiffView'
import { Button } from './ui/button'
import { cn } from '../utils/cn'
import { downloadText } from '../utils/download'
import useResizeObserver from '../hooks/useResizeObserver'
import { analyzeText } from '../utils/guards'

export type DiffExportFormat = 'html' | 'markdown' | 'unified'

export interface DiffSide {
  name: string
  content: string
}

export interface DiffExportRequest {
  left: DiffSide
  right: DiffSide
  format: DiffExportFormat
  includeMetadata?: boolean
  theme?: 'light' | 'dark'
  direction?: 'left-to-right' | 'right-to-left'
  leftLabel?: string
  rightLabel?: string
}

export interface DiffExportResult {
  content: string
  mime: string
  extension: string
}

export interface TwoFileDiffViewerProps {
  leftLabel?: string
  rightLabel?: string
  leftToRight?: boolean
  /** Provide initial file for the left side (baseline). */
  initialLeftFile?: DiffSide | null
  /** Provide initial file for the right side (comparison). */
  initialRightFile?: DiffSide | null
  /** Whether the viewer should start expanded. */
  defaultExpanded?: boolean
  /** Whether the viewer should start minimized. */
  defaultMinimized?: boolean
  /** Optional href used by the order notice learn-more link. */
  orderNoticeHref?: string
}

const ORDER_NOTICE_LINK =
  'https://github.com/AcidicSoil/codex-session-viewer/blob/main/docs/diff-viewer.md'

const ACCEPTED_EXT_RE = /\.(json|txt|md|js|ts|tsx|jsx|css|html|c|h|py|java|go|rs|yml|yaml|csv|sql|sh)$/i

function sanitizeFilenameSegment(name: string) {
  return name.replace(/[^a-z0-9.-]+/gi, '-').replace(/^-+|-+$/g, '') || 'file'
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatLines(lines: number) {
  return `${lines} line${lines === 1 ? '' : 's'}`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getInitialTheme(): 'light' | 'dark' {
  if (typeof document !== 'undefined') {
    const mode = document.documentElement.getAttribute('data-mode')
    if (mode === 'dark') return 'dark'
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

function buildMetadataLines(
  request: DiffExportRequest,
  generatedAt: string
): string[] {
  const { left, right, leftLabel, rightLabel, direction = 'left-to-right' } = request
  const baseline = direction === 'left-to-right' ? left : right
  const comparison = direction === 'left-to-right' ? right : left
  const baselineLabel = direction === 'left-to-right' ? leftLabel : rightLabel
  const comparisonLabel = direction === 'left-to-right' ? rightLabel : leftLabel
  return [
    `Generated: ${generatedAt}`,
    `Baseline (${baselineLabel ?? 'Left'}): ${baseline.name || 'untitled'}`,
    `Comparison (${comparisonLabel ?? 'Right'}): ${comparison.name || 'untitled'}`,
    `Direction: ${direction === 'left-to-right' ? 'left → right' : 'right → left'}`,
  ]
}

const DIFF2HTML_CSS = `
:root { color-scheme: light; }
body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  margin: 0;
  background: var(--diff-bg);
  color: var(--diff-fg);
}
main {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}
header {
  margin-bottom: 16px;
}
header h1 {
  font-size: 1.2rem;
  margin: 0 0 4px 0;
}
section.meta {
  border-radius: 8px;
  padding: 12px 16px;
  background: var(--diff-meta-bg);
  border: 1px solid var(--diff-border);
  margin-bottom: 16px;
}
section.meta ul {
  padding-left: 20px;
  margin: 8px 0 0 0;
}
section.meta li {
  margin: 2px 0;
}
.d2h-wrapper {
  border: 1px solid var(--diff-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--diff-panel-bg);
}
.d2h-file-header {
  background: var(--diff-header-bg);
  color: var(--diff-fg);
}
.d2h-code-side-line-number, .d2h-code-linenumber {
  background: var(--diff-line-number-bg);
  color: var(--diff-line-number-fg);
}
.d2h-del {
  background: var(--diff-del-bg) !important;
  color: var(--diff-del-fg) !important;
}
.d2h-ins {
  background: var(--diff-ins-bg) !important;
  color: var(--diff-ins-fg) !important;
}
.d2h-code-line {
  font-family: 'SFMono-Regular', ui-monospace, Menlo, Monaco, 'Courier New', monospace;
  font-size: 13px;
}
` as const

const LIGHT_THEME_VARS = `
:root {
  --diff-bg: #f8fafc;
  --diff-fg: #0f172a;
  --diff-meta-bg: #fff;
  --diff-border: rgba(15, 23, 42, 0.15);
  --diff-panel-bg: #fff;
  --diff-header-bg: rgba(15, 23, 42, 0.05);
  --diff-line-number-bg: rgba(15, 23, 42, 0.08);
  --diff-line-number-fg: rgba(15, 23, 42, 0.75);
  --diff-del-bg: #fee2e2;
  --diff-del-fg: #991b1b;
  --diff-ins-bg: #dcfce7;
  --diff-ins-fg: #166534;
}
` as const

const DARK_THEME_VARS = `
:root {
  color-scheme: dark;
  --diff-bg: #0f172a;
  --diff-fg: #e2e8f0;
  --diff-meta-bg: rgba(30, 41, 59, 0.75);
  --diff-border: rgba(148, 163, 184, 0.35);
  --diff-panel-bg: rgba(15, 23, 42, 0.9);
  --diff-header-bg: rgba(30, 41, 59, 0.7);
  --diff-line-number-bg: rgba(30, 41, 59, 0.9);
  --diff-line-number-fg: rgba(148, 163, 184, 0.9);
  --diff-del-bg: rgba(153, 27, 27, 0.4);
  --diff-del-fg: #fecaca;
  --diff-ins-bg: rgba(22, 101, 52, 0.4);
  --diff-ins-fg: #bbf7d0;
}
` as const

export function exportDiff(request: DiffExportRequest): DiffExportResult {
  const { left, right, format, includeMetadata = true, theme = 'light' } = request
  const diff = createTwoFilesPatch(
    left.name || 'left',
    right.name || 'right',
    left.content ?? '',
    right.content ?? '',
    '',
    '',
    { context: 3 }
  )

  const generatedAt = new Date().toISOString()
  const metadataLines = includeMetadata ? buildMetadataLines(request, generatedAt) : []

  if (format === 'unified') {
    const metaPrefix = includeMetadata ? `# ${metadataLines.join('\n# ')}\n\n` : ''
    return {
      content: `${metaPrefix}${diff}`,
      mime: 'text/plain;charset=utf-8',
      extension: 'diff',
    }
  }

  if (format === 'markdown') {
    const metaBlock = includeMetadata
      ? ['## Diff metadata', ...metadataLines.map((line) => `- ${line}`), ''].join('\n')
      : ''
    return {
      content: `${metaBlock}\n\n\`\`\`diff\n${diff}\n\`\`\`\n`,
      mime: 'text/markdown;charset=utf-8',
      extension: 'md',
    }
  }

  const html = Diff2Html.getPrettyHtml(diff, {
    inputFormat: 'diff',
    outputFormat: 'side-by-side',
    matching: 'lines',
    drawFileList: false,
  })
  const themeVars = theme === 'dark' ? DARK_THEME_VARS : LIGHT_THEME_VARS
  const metaSection = includeMetadata
    ? `<section class="meta"><h2>Diff metadata</h2><ul>${metadataLines
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('')}</ul></section>`
    : ''
  const title = `${escapeHtml(left.name || 'left')} vs ${escapeHtml(right.name || 'right')}`
  const heading = `${escapeHtml(left.name || 'left')} ↔ ${escapeHtml(right.name || 'right')}`
  const content = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${title}</title><meta name="viewport" content="width=device-width, initial-scale=1"/><style>${
    DIFF2HTML_CSS
  }${themeVars}</style></head><body><main><header><h1>${heading}</h1></header>${metaSection}${html}</main></body></html>`
  return {
    content,
    mime: 'text/html;charset=utf-8',
    extension: 'html',
  }
}

export default function TwoFileDiffViewer({
  leftLabel = 'Baseline',
  rightLabel = 'Proposed change',
  leftToRight = true,
  initialLeftFile = null,
  initialRightFile = null,
  defaultExpanded = false,
  defaultMinimized = false,
  orderNoticeHref = ORDER_NOTICE_LINK,
}: TwoFileDiffViewerProps) {
  const [leftFile, setLeftFile] = React.useState<DiffSide | null>(initialLeftFile)
  const [rightFile, setRightFile] = React.useState<DiffSide | null>(initialRightFile)
  const [isBaselineLeft, setIsBaselineLeft] = React.useState(leftToRight)
  const [showOrderNotice, setShowOrderNotice] = React.useState(true)
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded)
  const [isMinimized, setIsMinimized] = React.useState(defaultMinimized)
  const [isDraggingOver, setIsDraggingOver] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false)
  const [includeMetadata, setIncludeMetadata] = React.useState(true)
  const [exportTheme, setExportTheme] = React.useState<'light' | 'dark'>(() => getInitialTheme())
  const [layoutAnnouncement, setLayoutAnnouncement] = React.useState('')
  const [panelSizes, setPanelSizes] = React.useState<[number, number]>([68, 32])

  const dropRef = React.useRef<HTMLDivElement>(null)
  const leftInputRef = React.useRef<HTMLInputElement>(null)
  const rightInputRef = React.useRef<HTMLInputElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const diffPanelRef = React.useRef<HTMLDivElement>(null)

  const diffSize = useResizeObserver(diffPanelRef, {
    disabled: !leftFile || !rightFile || isMinimized,
    onResize: (size) => {
      setLayoutAnnouncement(
        `Diff viewer size ${Math.round(size.width)} by ${Math.round(size.height)} pixels.`
      )
    },
  })

  React.useEffect(() => {
    if (!exportMenuOpen || typeof document === 'undefined') return
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExportMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [exportMenuOpen])

  React.useEffect(() => {
    if (isMinimized && isExpanded) {
      setIsExpanded(false)
    }
  }, [isMinimized, isExpanded])

  React.useEffect(() => {
    setIsBaselineLeft(leftToRight)
  }, [leftToRight])

  React.useEffect(() => {
    setLeftFile(initialLeftFile ?? null)
  }, [initialLeftFile])

  React.useEffect(() => {
    setRightFile(initialRightFile ?? null)
  }, [initialRightFile])

  const hasDiff = Boolean(leftFile && rightFile)
  const orientationLabel = isBaselineLeft ? `${leftLabel} → ${rightLabel}` : `${rightLabel} → ${leftLabel}`

  const leftStats = React.useMemo(() => analyzeText(leftFile?.content ?? ''), [leftFile?.content])
  const rightStats = React.useMemo(() => analyzeText(rightFile?.content ?? ''), [rightFile?.content])

  const sanitizedFileName = React.useMemo(() => {
    if (!leftFile || !rightFile) return 'diff'
    return `${sanitizeFilenameSegment(leftFile.name)}-vs-${sanitizeFilenameSegment(rightFile.name)}`
  }, [leftFile, rightFile])

  const handleFiles = React.useCallback(
    async (list: FileList | null, explicitTarget?: 'left' | 'right') => {
      if (!list || list.length === 0) {
        setError('No files provided')
        return
      }
      const files = Array.from(list)
      if (files.some((file) => !file.type.startsWith('text/') && !ACCEPTED_EXT_RE.test(file.name))) {
        setError('Unsupported file type')
        return
      }
      if (!explicitTarget && files.length >= 2) {
        const [first, second] = files as [File, File, ...File[]]
        if (first.name === second.name && first.size === second.size) {
          setError('Duplicate files')
          return
        }
      }
      setError(null)
      if (explicitTarget) {
        const file = files[0]!
        const text = await file.text()
        if (explicitTarget === 'left') setLeftFile({ name: file.name, content: text })
        else setRightFile({ name: file.name, content: text })
        return
      }
      if (files.length === 1) {
        const file = files[0]!
        const text = await file.text()
        if (!leftFile) {
          setLeftFile({ name: file.name, content: text })
          setRightFile((prev) => prev ?? null)
        } else if (!rightFile) {
          setRightFile({ name: file.name, content: text })
        } else {
          setLeftFile({ name: file.name, content: text })
        }
      } else {
        const [first, second] = files as [File, File, ...File[]]
        const [textA, textB] = await Promise.all([first.text(), second.text()])
        setLeftFile({ name: first.name, content: textA })
        setRightFile({ name: second.name, content: textB })
        if (files.length > 2) {
          setError('Only the first two files were used')
        }
      }
    },
    [leftFile, rightFile]
  )

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingOver(false)
    void handleFiles(event.dataTransfer.files)
  }

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingOver(true)
  }

  const onDragLeave = () => setIsDraggingOver(false)

  const handleSwap = () => {
    if (!leftFile || !rightFile) return
    setLeftFile(rightFile)
    setRightFile(leftFile)
    setIsBaselineLeft((prev) => !prev)
  }

  const handleClear = () => {
    setLeftFile(null)
    setRightFile(null)
    setError(null)
  }

  const triggerFilePicker = (target: 'left' | 'right') => {
    if (target === 'left') leftInputRef.current?.click()
    else rightInputRef.current?.click()
  }

  const handleDropZoneClick = () => {
    if (!leftFile) triggerFilePicker('left')
    else if (!rightFile) triggerFilePicker('right')
    else triggerFilePicker('left')
  }

  const handleExport = (format: DiffExportFormat) => {
    if (!leftFile || !rightFile) return
    const result = exportDiff({
      left: leftFile,
      right: rightFile,
      format,
      includeMetadata,
      theme: exportTheme,
      direction: isBaselineLeft ? 'left-to-right' : 'right-to-left',
      leftLabel,
      rightLabel,
    })
    downloadText(`${sanitizedFileName}.${result.extension}`, result.content, result.mime)
    setExportMenuOpen(false)
  }

  const exportDisabled = !hasDiff
  const diffPanelSummary = hasDiff
    ? `${orientationLabel} — viewer ${Math.round(panelSizes[0])}%`
    : 'No diff loaded'

  return (
    <section className="relative space-y-3" aria-label="Two-file diff viewer">
      <div
        className={cn(
          'flex flex-col overflow-hidden rounded-lg border border-foreground/20 bg-background text-foreground shadow-sm transition-all',
          isExpanded && !isMinimized ? 'ring-2 ring-primary/70' : ''
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-foreground/10 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold">Two-file diff viewer</span>
            <span className="truncate text-xs text-foreground/60" title={diffPanelSummary}>
              {hasDiff
                ? `${leftFile?.name ?? 'Left'} ↔ ${rightFile?.name ?? 'Right'} (${orientationLabel})`
                : 'Drop or pick files to compare changes'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSwap}
              disabled={!hasDiff}
              aria-label="Swap diff sides"
            >
              Swap sides
            </Button>
            <div className="relative" ref={menuRef}>
              <Button
                variant="outline"
                size="sm"
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                onClick={() => setExportMenuOpen((open) => !open)}
                disabled={exportDisabled}
              >
                Export
              </Button>
              {exportMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-foreground/20 bg-background p-1 text-sm shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-foreground/10"
                    onClick={() => handleExport('html')}
                  >
                    HTML
                    <span className="text-[11px] uppercase text-foreground/50">.html</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-foreground/10"
                    onClick={() => handleExport('markdown')}
                  >
                    Markdown
                    <span className="text-[11px] uppercase text-foreground/50">.md</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-foreground/10"
                    onClick={() => handleExport('unified')}
                  >
                    Unified diff
                    <span className="text-[11px] uppercase text-foreground/50">.diff</span>
                  </button>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded((value) => !value)}
              aria-pressed={isExpanded}
              aria-label={isExpanded ? 'Collapse diff viewer height' : 'Expand diff viewer height'}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized((value) => !value)}
              aria-pressed={isMinimized}
              aria-label={isMinimized ? 'Restore diff viewer' : 'Minimize diff viewer'}
            >
              {isMinimized ? 'Restore' : 'Minimize'}
            </Button>
          </div>
        </header>
        {showOrderNotice && !isMinimized && (
          <div className="flex items-start gap-3 border-b border-foreground/10 bg-primary/5 px-4 py-3 text-sm">
            <div className="flex-1">
              <p>
                <strong className="font-medium">Order notice.</strong> {leftLabel} is treated as the
                baseline and {rightLabel} as the proposed change. Use swap to reverse direction.
              </p>
              <a
                href={orderNoticeHref}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-primary underline"
              >
                Learn more
              </a>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOrderNotice(false)}
              aria-label="Dismiss order notice"
            >
              Dismiss
            </Button>
          </div>
        )}
        {!isMinimized && (
          <>
            <div className="px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div
                  ref={dropRef}
                  data-testid="twofile-drop"
                  role="button"
                  tabIndex={0}
                  onClick={handleDropZoneClick}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleDropZoneClick()
                    }
                  }}
                  onDragEnter={onDragOver}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={cn(
                    'flex-1 rounded-md border-2 border-dashed px-4 py-6 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isDraggingOver ? 'border-primary bg-primary/10' : 'border-foreground/20'
                  )}
                >
                  <p className="font-medium text-foreground">Drop files or browse to compare</p>
                  <p className="mt-1 text-xs text-foreground/60">
                    Left slot: <strong>{leftFile?.name ?? 'empty'}</strong> — Right slot:{' '}
                    <strong>{rightFile?.name ?? 'empty'}</strong>
                  </p>
                  <p className="mt-2 text-xs text-foreground/50">
                    Tip: drop two files to fill both slots. Drop one file to replace the next open slot.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <Button variant="secondary" size="sm" onClick={() => triggerFilePicker('left')}>
                    Choose {leftLabel}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => triggerFilePicker('right')}>
                    Choose {rightLabel}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleClear} disabled={!leftFile && !rightFile}>
                    Clear
                  </Button>
                </div>
              </div>
              <input
                ref={leftInputRef}
                type="file"
                className="sr-only"
                onChange={(event) => {
                  void handleFiles(event.target.files, 'left')
                  if (event.target.value) event.target.value = ''
                }}
              />
              <input
                ref={rightInputRef}
                type="file"
                className="sr-only"
                onChange={(event) => {
                  void handleFiles(event.target.files, 'right')
                  if (event.target.value) event.target.value = ''
                }}
              />
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>
            <div className="border-t border-foreground/10 bg-foreground/[0.02] px-4 py-3">
              {hasDiff ? (
                <div
                  className="h-full min-h-[320px]"
                  style={{ height: isExpanded ? '70vh' : '54vh' }}
                  aria-label="Diff workspace"
                >
                  <PanelGroup
                    direction="horizontal"
                    className="h-full rounded-md border border-foreground/20 bg-background"
                    onLayout={(sizes) => {
                      setPanelSizes([sizes[0] ?? 0, sizes[1] ?? 0])
                      setLayoutAnnouncement(
                        `Panels resized. Diff ${Math.round(sizes[0] ?? 0)} percent, metadata ${Math.round(
                          sizes[1] ?? 0
                        )} percent.`
                      )
                    }}
                  >
                    <Panel defaultSize={68} minSize={35} className="h-full">
                      <div ref={diffPanelRef} className="flex h-full flex-col overflow-hidden">
                        <DiffView
                          path={rightFile?.name || leftFile?.name || 'diff'}
                          original={leftFile?.content ?? ''}
                          modified={rightFile?.content ?? ''}
                          height="100%"
                        />
                      </div>
                    </Panel>
                    <PanelResizeHandle
                      className="group relative flex w-3 cursor-col-resize items-center justify-center px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
                      aria-label="Resize diff viewer"
                    >
                      <span className="pointer-events-none h-12 w-[2px] rounded-full bg-foreground/20 transition group-hover:bg-primary" />
                    </PanelResizeHandle>
                    <Panel defaultSize={32} minSize={20} className="h-full overflow-hidden">
                      <div className="flex h-full flex-col gap-3 overflow-auto p-4 text-sm">
                        <h3 className="text-sm font-semibold text-foreground/80">Diff details</h3>
                        <dl className="grid grid-cols-1 gap-2 text-xs">
                          <div className="flex flex-col gap-1 rounded-md border border-foreground/10 bg-foreground/5 p-2">
                            <dt className="text-foreground/70">{leftLabel}</dt>
                            <dd className="text-foreground">{leftFile?.name ?? 'empty'}</dd>
                            <dd className="text-foreground/60">
                              {formatLines(leftStats.lines)} · {formatBytes(leftStats.bytes)}
                            </dd>
                          </div>
                          <div className="flex flex-col gap-1 rounded-md border border-foreground/10 bg-foreground/5 p-2">
                            <dt className="text-foreground/70">{rightLabel}</dt>
                            <dd className="text-foreground">{rightFile?.name ?? 'empty'}</dd>
                            <dd className="text-foreground/60">
                              {formatLines(rightStats.lines)} · {formatBytes(rightStats.bytes)}
                            </dd>
                          </div>
                          <div className="flex flex-col gap-1 rounded-md border border-foreground/10 bg-foreground/5 p-2">
                            <dt className="text-foreground/70">Orientation</dt>
                            <dd className="text-foreground">{orientationLabel}</dd>
                          </div>
                          <div className="flex flex-col gap-1 rounded-md border border-foreground/10 bg-foreground/5 p-2">
                            <dt className="text-foreground/70">Viewer size</dt>
                            <dd className="text-foreground/60">
                              {diffSize.width ? `${Math.round(diffSize.width)}px` : '—'} ×{' '}
                              {diffSize.height ? `${Math.round(diffSize.height)}px` : '—'}
                            </dd>
                          </div>
                        </dl>
                        <div className="space-y-2 border-t border-foreground/10 pt-3">
                          <div className="flex items-center justify-between">
                            <label htmlFor="diff-export-meta" className="text-xs font-medium">
                              Include metadata
                            </label>
                            <input
                              id="diff-export-meta"
                              type="checkbox"
                              checked={includeMetadata}
                              onChange={(event) => setIncludeMetadata(event.target.checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <label htmlFor="diff-export-theme" className="text-xs font-medium">
                              Export theme
                            </label>
                            <select
                              id="diff-export-theme"
                              value={exportTheme}
                              onChange={(event) => setExportTheme(event.target.value as 'light' | 'dark')}
                              className="rounded-md border border-foreground/20 bg-background px-2 py-1 text-xs"
                            >
                              <option value="light">Light</option>
                              <option value="dark">Dark</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </Panel>
                  </PanelGroup>
                </div>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center rounded-md border border-dashed border-foreground/20 text-sm text-foreground/70">
                  Load both files to preview the diff.
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div aria-live="polite" role="status" className="sr-only">
        {layoutAnnouncement}
      </div>
    </section>
  )
}

