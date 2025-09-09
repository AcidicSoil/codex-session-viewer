// Lightweight IndexedDB helpers for bookmarks persistence
// No external deps; promise-based wrappers around IDB APIs

export interface BookmarkRecord {
  scope: string
  keys: string[]
  updatedAt: number
}

const DB_NAME = 'csv'
const DB_VERSION = 1
const STORE_BOOKMARKS = 'bookmarks'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open error'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_BOOKMARKS)) {
        db.createObjectStore(STORE_BOOKMARKS, { keyPath: 'scope' })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

function idbGet<T = unknown>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readonly')
    const s = t.objectStore(store)
    const req = s.get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB get error'))
  })
}

function idbPut<T = unknown>(db: IDBDatabase, store: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite')
    const s = t.objectStore(store)
    const req = s.put(value as any)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('IndexedDB put error'))
  })
}

export async function loadBookmarks(scope = 'global'): Promise<string[] | undefined> {
  try {
    const db = await openDb()
    const rec = await idbGet<BookmarkRecord>(db, STORE_BOOKMARKS, scope)
    db.close()
    return rec?.keys
  } catch {
    return undefined
  }
}

export async function saveBookmarks(keys: string[], scope = 'global'): Promise<void> {
  try {
    const db = await openDb()
    const rec: BookmarkRecord = { scope, keys: Array.from(new Set(keys)), updatedAt: Date.now() }
    await idbPut(db, STORE_BOOKMARKS, rec)
    db.close()
  } catch {
    // swallow persistence failures; UI state remains authoritative
  }
}
