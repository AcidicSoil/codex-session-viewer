import * as React from 'react'
import { analyzeText } from '../utils/guards'
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

export interface DiffViewerProps {
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

export default function DiffViewer({ path, original, modified, language, height = 420 }: DiffViewerProps) {
  const lang = language ?? getLanguageForPath(path)
  const stats = React.useMemo(() => analyzeText(`${original}\n${modified}`), [original, modified])
  const tooLarge = stats.bytes > 1_000_000 || stats.lines > 20_000
  const isBinary = stats.binary
  const [sideBySide, setSideBySide] = React.useState(true)
  const [wrap, setWrap] = React.useState(true)
  // Theme: auto uses global mode; allow per-view override
  const { mode } = useTheme()
  const [editorThemePref, setEditorThemePref] = React.useState<'auto' | 'light' | 'dark'>('auto')
  // SSR guard: document may be undefined in tests/server
  const rootDataMode = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-mode')
    : null
  const monacoTheme = React.useMemo(
    () => computeMonacoTheme(mode, editorThemePref, rootDataMode),
    [mode, editorThemePref, rootDataMode]
  )

  return (
    <div className="border rounded">
      <div className="px-2 py-1 text-xs text-gray-600 border-b bg-gray-50 flex items-center justify-between">
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
      {isBinary && (
        <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-b">
          Binary-looking diff. Rendering disabled.
        </div>
      )}
      {tooLarge && !isBinary && (
        <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-b">
          Large diff detected ({'>'}1MB combined). Rendering may be slow.
        </div>
      )}
      {isBinary ? (
        <div className="p-3 text-sm text-gray-600">Binary data not shown.</div>
      ) : (
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
      )}
    </div>
  )
}
