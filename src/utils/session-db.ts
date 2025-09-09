import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { SessionMetaParsed, ResponseItemParsed } from '../parser'

const DB_NAME = 'csv-sessions'
const DB_VERSION = 1

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
}

let dbPromise: Promise<IDBPDatabase<SessionDBSchema>> | undefined

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SessionDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('fileHashes')) {
          db.createObjectStore('fileHashes', { keyPath: 'path' })
        }
      }
    })
  }
  return dbPromise
}

export async function saveSession(id: string, meta: SessionMetaParsed | undefined, events: ResponseItemParsed[]) {
  const db = await getDB()
  const now = Date.now()
  const rec: SessionRecord = { id, meta, events, createdAt: now, updatedAt: now }
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

export async function putHash(path: string, hash: string) {
  const db = await getDB()
  const rec: FileHashRecord = { path, hash, updatedAt: Date.now() }
  await db.put('fileHashes', rec)
}

export async function getHash(path: string) {
  const db = await getDB()
  return db.get('fileHashes', path)
}
