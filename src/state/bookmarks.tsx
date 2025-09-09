import * as React from 'react'
import { loadBookmarks, saveBookmarks } from '../utils/idb'

type BookmarksState = Set<string>

interface Ctx {
  has: (key: string) => boolean
  toggle: (key: string) => void
  clear: () => void
  keys: string[]
  // whether IndexedDB has been consulted (for UI that wants to gate on hydration)
  ready: boolean
}

const BookmarksContext = React.createContext<Ctx | null>(null)

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<BookmarksState>(() => {
    try {
      const raw = localStorage.getItem('csv:bookmarks')
      if (!raw) return new Set()
      const arr: unknown = JSON.parse(raw)
      if (Array.isArray(arr)) return new Set(arr.filter((x) => typeof x === 'string') as string[])
    } catch {}
    return new Set()
  })
  const [ready, setReady] = React.useState(false)

  const has = React.useCallback((key: string) => state.has(key), [state])
  const toggle = React.useCallback((key: string) => {
    setState((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])
  const clear = React.useCallback(() => setState(new Set()), [])

  const value = React.useMemo<Ctx>(() => ({ has, toggle, clear, keys: Array.from(state), ready }), [has, toggle, clear, state, ready])

  // persist
  React.useEffect(() => {
    try {
      localStorage.setItem('csv:bookmarks', JSON.stringify(Array.from(state)))
    } catch {}
  }, [state])

  // hydrate from IndexedDB and migrate from localStorage if needed
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const idbKeys = await loadBookmarks('global')
      if (cancelled) return
      if (Array.isArray(idbKeys) && idbKeys.length > 0) {
        // Prefer IDB if present
        setState(new Set(idbKeys))
      } else {
        // Attempt migration from localStorage to IDB
        try {
          const raw = localStorage.getItem('csv:bookmarks')
          const arr: unknown = raw ? JSON.parse(raw) : []
          const keys = Array.isArray(arr) ? (arr.filter((x) => typeof x === 'string') as string[]) : []
          if (keys.length > 0) {
            await saveBookmarks(keys, 'global')
          }
        } catch {}
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // write-through to IndexedDB on changes
  React.useEffect(() => {
    // Fire-and-forget; ignore failures
    saveBookmarks(Array.from(state), 'global')
  }, [state])

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>
}

export function useBookmarks() {
  const ctx = React.useContext(BookmarksContext)
  if (!ctx) throw new Error('useBookmarks must be used within BookmarksProvider')
  return ctx
}
