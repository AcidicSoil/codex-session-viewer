import * as React from 'react'
import { analyzeText, safeTruncate } from '../utils/guards'
import { useTheme } from '../state/theme'
import { getLanguageForPath } from '../utils/language'

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
  height?: number | string
}

export function computeMonacoTheme(appMode: string, pref: 'auto'|'light'|'dark', dataMode: string | null): 'vs'|'vs-dark' {
  if (pref === 'light') return 'vs'
  if (pref === 'dark') return 'vs-dark'
  const finalMode = appMode === 'system' ? (dataMode === 'dark' ? 'dark' : 'light') : appMode
  return finalMode === 'dark' ? 'vs-dark' : 'vs'
}

export default function DiffView({ path, original, modified, language, height = 420 }: DiffViewProps) {
  const lang = language ?? getLanguageForPath(path)
  const stats = React.useMemo(() => analyzeText(`${original}\n${modified}`), [original, modified])
  const isBinary = stats.binary
  const isLarge = stats.bytes > LARGE_DIFF_THRESHOLD || stats.lines > 20_000

  if (isBinary) {
    return (
      <div className="border rounded">
        <div className="px-2 py-1 text-xs text-gray-600 border-b bg-gray-50">{path || 'Diff'}</div>
        <div className="p-3 text-sm text-gray-600">Binary file – cannot display diff</div>
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
      <div className="border rounded">
        <div className="px-2 py-1 text-xs text-gray-600 border-b bg-gray-50">{path || 'Diff'}</div>
        <div className="p-3 text-sm text-gray-600">
          <p className="mb-2">
            Diff too large to display. Showing first {previewLines} lines.{' '}
            <a href={downloadUrl} download="diff.txt" className="text-blue-600 hover:underline">
              download full diff
            </a>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <pre className="bg-gray-50 p-2 rounded overflow-auto max-h-[420px]" aria-label="Original">
              {safeTruncate(previewOriginal, 20_000)}
            </pre>
            <pre className="bg-gray-50 p-2 rounded overflow-auto max-h-[420px]" aria-label="Modified">
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

  return (
    <div className="border rounded">
      <div className="px-2 py-1 text-xs text-gray-600 border-b bg-gray-50/95 backdrop-blur supports-[backdrop-filter]:bg-gray-50/75 sticky top-0 z-10 flex items-center justify-between">
        <span className="truncate" title={path}>{path || 'Diff'}</span>
        <div className="flex items-center gap-2">
          <label className="sr-only">Editor theme</label>
          <select
            aria-label="Editor theme"
            className="border rounded px-1 py-0.5 bg-white text-gray-700"
            value={editorThemePref}
            onChange={(e) => setEditorThemePref(e.target.value as any)}
            title="Editor theme"
          >
            <option value="auto">auto</option>
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
          <button className="text-gray-500 hover:text-gray-700" onClick={() => setWrap((w) => !w)} title="Toggle wrap">
            {wrap ? 'Wrap' : 'No wrap'}
          </button>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={() => setSideBySide((s) => !s)}
            title="Toggle view"
          >
            {sideBySide ? 'Split' : 'Inline'}
          </button>
          <span className="text-gray-400">{lang}</span>
        </div>
      </div>
      <React.Suspense
        fallback={
          <div className="p-3 text-sm text-gray-600">
            <p className="mb-2">Loading Monaco DiffEditor…</p>
            <div className="grid grid-cols-2 gap-2">
              <pre className="bg-gray-50 p-2 rounded overflow-auto max-h-[420px]" aria-label="Original">
                {original}
              </pre>
              <pre className="bg-gray-50 p-2 rounded overflow-auto max-h-[420px]" aria-label="Modified">
                {modified}
              </pre>
            </div>
          </div>
        }
      >
        {/* @ts-ignore - DiffEditor types are available when the package is installed */}
        <MonacoDiff
          height={typeof height === 'number' ? `${height}px` : height}
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
          }}
        />
      </React.Suspense>
    </div>
  )
}
