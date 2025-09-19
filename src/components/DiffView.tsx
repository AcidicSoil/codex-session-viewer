import * as React from 'react'
import type { editor as MonacoEditor, IDisposable } from 'monaco-editor'
import { analyzeText, safeTruncate } from '../utils/guards'
import { useTheme } from '../state/theme'
import { getLanguageForPath } from '../utils/language'

// Lazy-load Monaco to keep baseline bundle light and to avoid hard failure
// if the dependency isn't installed yet. We also provide a graceful fallback.
const MonacoDiff = React.lazy(async () => {
  try {
    const mod = await import('@monaco-editor/react')
    return { default: mod.DiffEditor as React.ComponentType<any> }
  } catch (e) {
    // Re-throw to hit Suspense fallback below; caller will render plain view
    throw e
  }
})

export const LARGE_DIFF_THRESHOLD = 500_000

export interface DiffViewProps {
  path?: string
  original: string
  modified: string
  language?: string
  height?: number | string
}

const MIN_AUTO_HEIGHT = 320
const MAX_AUTO_HEIGHT = 1200

export function computeMonacoTheme(appMode: string, pref: 'auto'|'light'|'dark', dataMode: string | null): 'vs'|'vs-dark' {
  if (pref === 'light') return 'vs'
  if (pref === 'dark') return 'vs-dark'
  const finalMode = appMode === 'system' ? (dataMode === 'dark' ? 'dark' : 'light') : appMode
  return finalMode === 'dark' ? 'vs-dark' : 'vs'
}

export default function DiffView({ path, original, modified, language, height }: DiffViewProps) {
  const lang = language ?? getLanguageForPath(path)
  const stats = React.useMemo(() => analyzeText(`${original}\n${modified}`), [original, modified])
  const isBinary = stats.binary
  const isLarge = stats.bytes > LARGE_DIFF_THRESHOLD || stats.lines > 20_000

  const shouldAutoSize = height == null
  const containerRef = React.useRef<HTMLDivElement>(null)
  const diffEditorRef = React.useRef<MonacoEditor.IStandaloneDiffEditor | null>(null)
  const disposablesRef = React.useRef<IDisposable[]>([])
  const originalContentHeightRef = React.useRef(0)
  const modifiedContentHeightRef = React.useRef(0)
  const [autoHeight, setAutoHeight] = React.useState(MIN_AUTO_HEIGHT)
  const [isHeightClamped, setIsHeightClamped] = React.useState(false)

  const applyMeasuredHeight = React.useCallback(() => {
    if (!shouldAutoSize) return
    const measured = Math.max(
      originalContentHeightRef.current,
      modifiedContentHeightRef.current,
      MIN_AUTO_HEIGHT
    )
    const clamped = Math.min(measured, MAX_AUTO_HEIGHT)
    setAutoHeight(clamped)
    setIsHeightClamped(clamped < measured)
  }, [shouldAutoSize])

  const handleEditorMount = React.useCallback(
    (editor: MonacoEditor.IStandaloneDiffEditor, _monaco: unknown) => {
      diffEditorRef.current = editor
      for (const disposable of disposablesRef.current) {
        disposable.dispose()
      }
      disposablesRef.current = []

      if (!shouldAutoSize) {
        return
      }

      const originalEditor = editor.getOriginalEditor()
      const modifiedEditor = editor.getModifiedEditor()
      originalContentHeightRef.current = originalEditor.getContentHeight()
      modifiedContentHeightRef.current = modifiedEditor.getContentHeight()

      const originalDisposable = originalEditor.onDidContentSizeChange((event) => {
        originalContentHeightRef.current = event.contentHeight
        applyMeasuredHeight()
      })
      const modifiedDisposable = modifiedEditor.onDidContentSizeChange((event) => {
        modifiedContentHeightRef.current = event.contentHeight
        applyMeasuredHeight()
      })

      disposablesRef.current = [originalDisposable, modifiedDisposable]
      applyMeasuredHeight()
    },
    [applyMeasuredHeight, shouldAutoSize]
  )

  React.useEffect(() => {
    return () => {
      for (const disposable of disposablesRef.current) {
        disposable.dispose()
      }
      disposablesRef.current = []
      diffEditorRef.current = null
    }
  }, [])

  React.useEffect(() => {
    if (!shouldAutoSize) return
    originalContentHeightRef.current = 0
    modifiedContentHeightRef.current = 0
    setAutoHeight(MIN_AUTO_HEIGHT)
    setIsHeightClamped(false)

    const editor = diffEditorRef.current
    if (!editor) return
    originalContentHeightRef.current = editor.getOriginalEditor().getContentHeight()
    modifiedContentHeightRef.current = editor.getModifiedEditor().getContentHeight()
    applyMeasuredHeight()
  }, [original, modified, shouldAutoSize, applyMeasuredHeight])

  const layoutEditor = React.useCallback(() => {
    if (!shouldAutoSize) return
    const editor = diffEditorRef.current
    const container = containerRef.current
    if (!editor || !container) return
    editor.layout({
      width: container.clientWidth,
      height: autoHeight,
    })
  }, [autoHeight, shouldAutoSize])

  React.useEffect(() => {
    if (!shouldAutoSize) return
    layoutEditor()
  }, [autoHeight, layoutEditor, shouldAutoSize])

  React.useEffect(() => {
    if (!shouldAutoSize) return
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      if (!diffEditorRef.current) return
      layoutEditor()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [layoutEditor, shouldAutoSize])

  React.useEffect(() => {
    if (!shouldAutoSize) return
    layoutEditor()
  }, [shouldAutoSize, layoutEditor])

  if (isBinary) {
    return (
      <div className="border rounded border-foreground/20 bg-background text-foreground">
        <div className="px-2 py-1 text-xs text-foreground/70 border-b border-foreground/20 bg-background/80">{path || 'Diff'}</div>
        <div className="p-3 text-sm text-foreground/70">Binary file – cannot display diff</div>
      </div>
    )
  }

  if (isLarge) {
    const previewLines = 200
    const previewOriginal = React.useMemo(() => original.split(/\r?\n/).slice(0, previewLines).join('\n'), [original])
    const previewModified = React.useMemo(() => modified.split(/\r?\n/).slice(0, previewLines).join('\n'), [modified])
    const downloadUrl = React.useMemo(() => {
      try {
        const blob = new Blob([`--- Original\n${original}\n--- Modified\n${modified}`], { type: 'text/plain' })
        return URL.createObjectURL(blob)
      } catch {
        return ''
      }
    }, [original, modified])
    return (
      <div className="border rounded border-foreground/20 bg-background text-foreground">
        <div className="px-2 py-1 text-xs text-foreground/70 border-b border-foreground/20 bg-background/80">{path || 'Diff'}</div>
        <div className="p-3 text-sm text-foreground/70">
          <p className="mb-2">
            Diff too large to display. Showing first {previewLines} lines.{' '}
            <a href={downloadUrl} download="diff.txt" className="text-blue-600 hover:underline">
              download full diff
            </a>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <pre className="bg-background/80 p-2 rounded overflow-auto max-h-[420px]" aria-label="Original">
              {safeTruncate(previewOriginal, 20_000)}
            </pre>
            <pre className="bg-background/80 p-2 rounded overflow-auto max-h-[420px]" aria-label="Modified">
              {safeTruncate(previewModified, 20_000)}
            </pre>
          </div>
        </div>
      </div>
    )
  }

  const [sideBySide, setSideBySide] = React.useState(true)
  const [wrap, setWrap] = React.useState(true)
  const { mode } = useTheme()
  const [editorThemePref, setEditorThemePref] = React.useState<'auto' | 'light' | 'dark'>('auto')
  const rootDataMode = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-mode')
    : null
  const monacoTheme = React.useMemo(
    () => computeMonacoTheme(mode, editorThemePref, rootDataMode),
    [mode, editorThemePref, rootDataMode]
  )

  React.useEffect(() => {
    if (!shouldAutoSize) return
    const editor = diffEditorRef.current
    if (!editor) return
    originalContentHeightRef.current = editor.getOriginalEditor().getContentHeight()
    modifiedContentHeightRef.current = editor.getModifiedEditor().getContentHeight()
    applyMeasuredHeight()
  }, [sideBySide, wrap, shouldAutoSize, applyMeasuredHeight])

  React.useEffect(() => {
    diffEditorRef.current?.updateOptions({
      renderSideBySide: sideBySide,
      wordWrap: wrap ? 'on' : 'off',
    })
  }, [sideBySide, wrap])

  const explicitHeight = React.useMemo(() => {
    if (height == null) return undefined
    return typeof height === 'number' ? `${height}px` : height
  }, [height])

  const autoSizedHeight = React.useMemo(() => {
    if (!shouldAutoSize) return undefined
    return `${autoHeight}px`
  }, [autoHeight, shouldAutoSize])

  const containerStyle = React.useMemo<React.CSSProperties>(() => {
    if (!shouldAutoSize) {
      if (explicitHeight == null) {
        return {}
      }
      return {
        height: explicitHeight,
        overflowY: 'auto',
      }
    }
    return {
      height: autoSizedHeight,
      minHeight: `${MIN_AUTO_HEIGHT}px`,
      overflowY: isHeightClamped ? 'auto' : 'hidden',
    }
  }, [autoSizedHeight, explicitHeight, isHeightClamped, shouldAutoSize])

  return (
    <div className="border rounded border-foreground/20 bg-background text-foreground">
      <div className="px-2 py-1 text-xs text-foreground/70 border-b border-foreground/20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex items-center justify-between">
        <span className="truncate" title={path}>{path || 'Diff'}</span>
        <div className="flex items-center gap-2">
          <label className="sr-only">Editor theme</label>
          <select
            aria-label="Editor theme"
            className="border border-foreground/20 rounded px-1 py-0.5 bg-background text-foreground"
            value={editorThemePref}
            onChange={(e) => setEditorThemePref(e.target.value as any)}
            title="Editor theme"
          >
            <option value="auto">auto</option>
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
          <button className="text-foreground/70 hover:text-foreground" onClick={() => setWrap((w) => !w)} title="Toggle wrap">
            {wrap ? 'Wrap' : 'No wrap'}
          </button>
          <button
            className="text-foreground/70 hover:text-foreground"
            onClick={() => setSideBySide((s) => !s)}
            title="Toggle view"
          >
            {sideBySide ? 'Split' : 'Inline'}
          </button>
          <span className="text-foreground/50">{lang}</span>
        </div>
      </div>
      <div ref={containerRef} className="relative w-full" style={containerStyle}>
        <React.Suspense
          fallback={
            <div className="p-3 text-sm text-foreground/70">
              <p className="mb-2">Loading Monaco DiffEditor…</p>
              <div className="grid grid-cols-2 gap-2">
                <pre className="bg-background/80 p-2 rounded overflow-auto max-h-[420px]" aria-label="Original">
                  {original}
                </pre>
                <pre className="bg-background/80 p-2 rounded overflow-auto max-h-[420px]" aria-label="Modified">
                  {modified}
                </pre>
              </div>
            </div>
          }
        >
          {/* @ts-ignore - DiffEditor types are available when the package is installed */}
          <MonacoDiff
            height={explicitHeight ?? autoSizedHeight}
            original={original}
            modified={modified}
            language={lang}
            theme={monacoTheme}
            onMount={handleEditorMount}
            options={{
              readOnly: true,
              renderSideBySide: sideBySide,
              wordWrap: wrap ? 'on' : 'off',
              minimap: { enabled: false },
              diffAlgorithm: 'smart',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              scrollbar: {
                vertical: 'hidden',
                verticalScrollbarSize: 0,
                alwaysConsumeMouseWheel: false,
              },
            }}
          />
        </React.Suspense>
      </div>
    </div>
  )
}
