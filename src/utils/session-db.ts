import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { SessionMetaParsed, ResponseItemParsed } from '../parser'

const DB_NAME = 'csv-sessions'
const DB_VERSION = 2

export interface SessionRecord {
  id: string
  meta?: SessionMetaParsed
  events: ResponseItemParsed[]
  createdAt: number
  updatedAt: number
}

export interface FileHashRecord {
  path: string
  hash: string
  updatedAt: number
  mtime?: number
}

interface SessionDBSchema extends DBSchema {
  sessions: {
    key: string
    value: SessionRecord
  }
  fileHashes: {
    key: string
    value: FileHashRecord
  }
  settings: {
    key: string
    value: any
  }
}

let dbPromise: Promise<IDBPDatabase<SessionDBSchema>> | undefined

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SessionDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db: IDBPDatabase<SessionDBSchema>) {
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('fileHashes')) {
          db.createObjectStore('fileHashes', { keyPath: 'path' })
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings')
        }
      }
    })
  }
  return dbPromise
}

export async function saveSession(id: string, meta: SessionMetaParsed | undefined, events: ResponseItemParsed[]) {
  const db = await getDB()
  const existing = await db.get('sessions', id)
  const now = Date.now()
  const rec: SessionRecord = {
    id,
    meta,
    events,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  }
  await db.put('sessions', rec)
}

export async function loadSession(id: string) {
  const db = await getDB()
  return db.get('sessions', id)
}

export async function listSessions() {
  const db = await getDB()
  return db.getAll('sessions')
}

export async function deleteSession(id: string) {
  const db = await getDB()
  await db.delete('sessions', id)
}

export async function putHash(path: string, hash: string, mtime?: number) {
  const db = await getDB()
  const rec: FileHashRecord = { path, hash, mtime, updatedAt: Date.now() }
  await db.put('fileHashes', rec)
}

export async function getHash(path: string) {
  const db = await getDB()
  return db.get('fileHashes', path)
}


// Settings helpers (e.g., persisted handles)
export async function setSetting<T = any>(key: string, value: T) {
  const db = await getDB()
  await db.put('settings', value, key)
}

export async function getSetting<T = any>(key: string): Promise<T | undefined> {
  const db = await getDB()
  return db.get('settings', key) as any
}

export async function deleteSetting(key: string) {
  const db = await getDB()
  await db.delete('settings', key)
}

export async function listHashes() {
  const db = await getDB()
  return db.getAll('fileHashes')
}
