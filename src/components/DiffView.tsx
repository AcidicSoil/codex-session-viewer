import * as React from 'react'
import { analyzeText, safeTruncate } from '../utils/guards'
import { useTheme } from '../state/theme'
import { getLanguageForPath } from '../utils/language'
import useResizeObserver from '../hooks/useResizeObserver'

// Lazy-load Monaco to keep baseline bundle light and to avoid hard failure
// if the dependency isn't installed yet. We also provide a graceful fallback.
const MonacoDiff = React.lazy(async () => {
  try {
    const mod = await import('@monaco-editor/react')
    return { default: mod.DiffEditor }
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
  /**
   * Explicit height to use for the diff viewport. When omitted the component
   * auto-sizes to the tallest editor content height and reports the measured
   * value via `onHeightChange`.
   */
  height?: number
  onHeightChange?: (height: number) => void
}

export function computeMonacoTheme(appMode: string, pref: 'auto'|'light'|'dark', dataMode: string | null): 'vs'|'vs-dark' {
  if (pref === 'light') return 'vs'
  if (pref === 'dark') return 'vs-dark'
  const finalMode = appMode === 'system' ? (dataMode === 'dark' ? 'dark' : 'light') : appMode
  return finalMode === 'dark' ? 'vs-dark' : 'vs'
}

type Monaco = typeof import('monaco-editor')

const MIN_EDITOR_HEIGHT = 200

export default function DiffView({
  path,
  original,
  modified,
  language,
  height,
  onHeightChange,
}: DiffViewProps) {
  const lang = language ?? getLanguageForPath(path)
  const stats = React.useMemo(() => analyzeText(`${original}\n${modified}`), [original, modified])
  const isBinary = stats.binary
  const isLarge = stats.bytes > LARGE_DIFF_THRESHOLD || stats.lines > 20_000

  const containerRef = React.useRef<HTMLDivElement>(null)
  const diffEditorRef = React.useRef<Monaco.editor.IDiffEditor | null>(null)
  const disposablesRef = React.useRef<Monaco.IDisposable[]>([])
  const [autoHeight, setAutoHeight] = React.useState<number>(height ?? Math.max(stats.lines * 20, MIN_EDITOR_HEIGHT))

  const finalHeight = React.useMemo(() => {
    if (typeof height === 'number') {
      return height
    }
    return Math.max(autoHeight, MIN_EDITOR_HEIGHT)
  }, [autoHeight, height])

  const measureHeight = React.useCallback(
    (editor?: Monaco.editor.IDiffEditor | null) => {
      const instance = editor ?? diffEditorRef.current
      if (!instance) return
      const originalEditor = instance.getOriginalEditor()
      const modifiedEditor = instance.getModifiedEditor()
      const originalHeight = originalEditor.getContentHeight()
      const modifiedHeight = modifiedEditor.getContentHeight()
      const nextHeight = Math.max(originalHeight, modifiedHeight, MIN_EDITOR_HEIGHT)
      setAutoHeight((prev) => {
        if (Math.abs(prev - nextHeight) <= 1) {
          return prev
        }
        return nextHeight
      })
      if (onHeightChange) {
        onHeightChange(nextHeight)
      }
    },
    [onHeightChange]
  )

  const layoutEditor = React.useCallback(
    (editor?: Monaco.editor.IDiffEditor | null) => {
      const instance = editor ?? diffEditorRef.current
      const node = containerRef.current
      if (!instance || !node) return
      const width = node.clientWidth
      if (width <= 0) return
      instance.layout({ width, height: finalHeight })
    },
    [finalHeight]
  )

  const cleanupDisposables = React.useCallback(() => {
    for (const disposable of disposablesRef.current) {
      try {
        disposable.dispose()
      } catch {
        // ignore disposal errors
      }
    }
    disposablesRef.current = []
  }, [])

  useResizeObserver(containerRef, {
    debounceMs: 60,
    onResize: () => layoutEditor(),
  })

  if (isBinary) {
    return (
      <div className="border rounded border-foreground/20 bg-background text-foreground" ref={containerRef}>
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
      <div className="border rounded border-foreground/20 bg-background text-foreground" ref={containerRef}>
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

  const handleDiffMount = React.useCallback(
    (editor: Monaco.editor.IDiffEditor) => {
      cleanupDisposables()
      diffEditorRef.current = editor
      const originalEditor = editor.getOriginalEditor()
      const modifiedEditor = editor.getModifiedEditor()
      editor.updateOptions({
        scrollBeyondLastLine: false,
      })
      originalEditor.updateOptions({
        scrollBeyondLastLine: false,
        scrollbar: { vertical: 'hidden' as const },
      })
      modifiedEditor.updateOptions({
        scrollBeyondLastLine: false,
        scrollbar: { vertical: 'hidden' as const },
      })
      disposablesRef.current = [
        originalEditor.onDidContentSizeChange(() => {
          measureHeight(editor)
          layoutEditor(editor)
        }),
        modifiedEditor.onDidContentSizeChange(() => {
          measureHeight(editor)
          layoutEditor(editor)
        }),
        editor.onDidUpdateDiff(() => {
          measureHeight(editor)
          layoutEditor(editor)
        }),
        editor.onDidDispose(() => {
          cleanupDisposables()
          diffEditorRef.current = null
        }),
      ]
      // ensure initial measurements once models are ready
      setTimeout(() => {
        measureHeight(editor)
        layoutEditor(editor)
      }, 0)
    },
    [cleanupDisposables, layoutEditor, measureHeight]
  )

  React.useEffect(() => {
    return () => {
      cleanupDisposables()
      diffEditorRef.current = null
    }
  }, [cleanupDisposables])

  React.useEffect(() => {
    measureHeight()
    layoutEditor()
  }, [measureHeight, layoutEditor, original, modified])

  React.useEffect(() => {
    layoutEditor()
  }, [layoutEditor, finalHeight])

  return (
    <div
      className="border rounded border-foreground/20 bg-background text-foreground"
      ref={containerRef}
      style={{ height: `${finalHeight}px` }}
    >
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
          height={`${finalHeight}px`}
          original={original}
          modified={modified}
          language={lang}
          theme={monacoTheme}
          options={{
            readOnly: true,
            renderSideBySide: sideBySide,
            wordWrap: wrap ? 'on' : 'off',
            minimap: { enabled: false },
            diffAlgorithm: 'smart',
            automaticLayout: false,
            scrollBeyondLastLine: false,
            scrollbar: { vertical: 'hidden' },
          }}
          onMount={handleDiffMount}
        />
      </React.Suspense>
    </div>
  )
}
