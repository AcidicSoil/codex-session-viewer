# Session DB

`src/utils/session-db.ts` provides a thin wrapper around IndexedDB for caching session content and file hashes.

## Stores

### sessions

```ts
interface SessionRecord {
  id: string
  meta?: SessionMetaParsed
  events: ResponseItemParsed[]
  createdAt: number
  updatedAt: number
}
```

### fileHashes
Stores file hashes along with an optional modification timestamp to avoid re-hashing unchanged files.
```ts
interface FileHashRecord {
  path: string
  hash: string
  mtime?: number
  updatedAt: number
}
```

## CRUD snippets

```ts
import {
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  putHash,
  getHash
} from '../src/utils/session-db'

await saveSession(id, meta, events)        // create/update
const session = await loadSession(id)      // read
const all = await listSessions()           // list
await deleteSession(id)                    // delete

await putHash(path, hash, mtime)           // create/update hash with modification time
const hashRec = await getHash(path)        // read hash
```


