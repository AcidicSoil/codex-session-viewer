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

```ts
interface FileHashRecord {
  path: string
  hash: string
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

await putHash(path, hash)                  // create/update hash
const hashRec = await getHash(path)        // read hash
```


