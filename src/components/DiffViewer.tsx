import * as React from 'react'

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

export default function DiffViewer({ path, original, modified, language = 'plaintext', height = 420 }: DiffViewerProps) {
  const tooLarge = (original?.length || 0) + (modified?.length || 0) > 1_000_000
  return (
    <div className="border rounded">
      <div className="px-2 py-1 text-xs text-gray-600 border-b bg-gray-50 flex items-center justify-between">
        <span className="truncate" title={path}>{path || 'Diff'}</span>
        <span className="text-gray-400">{language}</span>
      </div>
      {tooLarge && (
        <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-b">
          Large diff detected ({'>'}1MB combined). Rendering may be slow.
        </div>
      )}
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
          language={language}
          theme="vs"
          options={{
            readOnly: true,
            renderSideBySide: true,
            wordWrap: 'on',
            minimap: { enabled: false },
            diffAlgorithm: 'smart',
          }}
        />
      </React.Suspense>
    </div>
  )
}
