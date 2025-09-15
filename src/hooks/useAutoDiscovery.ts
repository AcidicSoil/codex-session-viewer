import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface DiscoveredSessionAsset {
  path: string
  url: string
  sortKey?: number
}

/**
 * Lightweight, build-time discovery of project files and session logs.
 *
 * Notes:
 * - Uses Vite's import.meta.glob. This only sees files inside the Vite project root.
 * - Project files are returned as normalized repo-relative paths for display only.
 * - Session assets are returned as URLs so the UI can fetch and parse them on demand.
 * - Everything is optional: if no matches exist, arrays are empty.
 */
export function useAutoDiscovery() {
  const [projectFiles, setProjectFiles] = useState<string[]>([])
  const [sessionAssets, setSessionAssets] = useState<DiscoveredSessionAsset[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<number | null>(null)

  const scan = useCallback(() => {
    setIsLoading(true)
    try {
      const codeGlobs = import.meta.glob([
        '/src/**/*',
        '/scripts/**/*',
        '/public/**/*',
        '/package.json',
        '/tsconfig.json',
        '!/src/**/__tests__/**',
        '!/src/**/__mocks__/**',
        '!/src/**/*.test.{ts,tsx,js,jsx}',
        '!/src/**/*.spec.{ts,tsx,js,jsx}',
        '!/src/**/*.stories.{ts,tsx,js,jsx}',
      ]) as Record<string, () => Promise<unknown>>

      const docAssets = import.meta.glob([
        '/README*',
        '/AGENTS.md',
      ], { eager: true, query: '?url', import: 'default' }) as Record<string, string>

      const isIgnoredPath = (p: string) => (
        /\/(?:__tests__|__mocks__)\//.test(p)
        || /\.(?:test|spec|stories)\.[a-z0-9]+$/i.test(p)
      )

      const raw = [
        ...Object.keys(codeGlobs),
        ...Object.keys(docAssets),
      ]
      const files = Array.from(new Set(
        raw
          .filter((p) => /\.[a-z0-9]+$/i.test(p))
          .filter((p) => !p.endsWith('.map'))
          .filter((p) => !p.endsWith('.d.ts'))
          .filter((p) => !isIgnoredPath(p))
          .map((p) => p.replace(/^\//, ''))
      )).sort()
      setProjectFiles(files)

      const matches = import.meta.glob(
        [
          '/.codex/sessions/**/*.{jsonl,ndjson,json}',
          '/sessions/**/*.{jsonl,ndjson,json}',
          '/artifacts/sessions/**/*.{jsonl,ndjson,json}',
        ],
        { eager: true, query: '?url', import: 'default' }
      ) as Record<string, string>

      const tsInPath = (p: string) => {
        const m = p.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/)
        if (m) {
          const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
          if (mo>=1&&mo<=12&&d>=1&&d<=31) return Date.UTC(y, mo-1, d)
        }
        const epoch = p.match(/(1\d{9}|2\d{9})/)
        if (epoch) return Number(epoch[1]) * 1000
        return 0
      }

      const sessions = Object.entries(matches)
        .map(([path, url]) => ({ path: path.replace(/^\//, ''), url, sortKey: tsInPath(path) }))
        .sort((a, b) => b.sortKey! - a.sortKey! || a.path.localeCompare(b.path))
      setSessionAssets(sessions)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reload = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      scan()
    }, 350)
  }, [scan])

  useEffect(() => { scan() }, [scan])

  return { projectFiles, sessionAssets, isLoading, reload }
}

export default useAutoDiscovery
