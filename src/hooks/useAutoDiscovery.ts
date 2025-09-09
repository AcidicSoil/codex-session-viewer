import { useMemo } from 'react'

export interface DiscoveredSessionAsset {
  path: string
  url: string
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
  // Project files: gather a broad but safe subset of source-like files.
  const projectFiles = useMemo(() => {
    // We only need the keys (paths). Use asset URLs for non-code like *.md
    // to avoid Vite trying to parse them as JS during import analysis.
    const codeGlobs = import.meta.glob([
      '/src/**/*',
      '/scripts/**/*',
      '/public/**/*',
      '/package.json',
      '/tsconfig.json',
    ]) as Record<string, () => Promise<unknown>>

    const docAssets = import.meta.glob([
      '/README*',
      '/AGENTS.md',
    ], { eager: true, query: '?url', import: 'default' }) as Record<string, string>

    const raw = [
      ...Object.keys(codeGlobs),
      ...Object.keys(docAssets),
    ]
    // Filter out directories and non-file endings (heuristic) and exclude maps/types.
    const filtered = raw
      .filter((p) => /\.[a-z0-9]+$/i.test(p))
      .filter((p) => !p.endsWith('.map'))
      .filter((p) => !p.endsWith('.d.ts'))
      .map((p) => p.replace(/^\//, ''))

    return Array.from(new Set(filtered)).sort()
  }, [])

  // Session assets: attempt to find logs under conventional locations.
  const sessionAssets = useMemo<DiscoveredSessionAsset[]>(() => {
    // Return file URLs so we can fetch them at runtime.
    // NOTE: Vite 5 deprecates `as: 'url'` in favor of `query: '?url', import: 'default'`.
    const matches = import.meta.glob(
      [
        '/.codex/sessions/**/*.{jsonl,ndjson,json}',
        '/sessions/**/*.{jsonl,ndjson,json}',
        '/artifacts/sessions/**/*.{jsonl,ndjson,json}',
      ],
      { eager: true, query: '?url', import: 'default' }
    ) as Record<string, string>

    return Object.entries(matches)
      .map(([path, url]) => ({ path: path.replace(/^\//, ''), url }))
      .sort((a, b) => a.path.localeCompare(b.path))
  }, [])

  return { projectFiles, sessionAssets }
}

export default useAutoDiscovery
