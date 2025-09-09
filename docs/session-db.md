# Session Database

Sessions, file hashes are stored in IndexedDB using [idb](https://github.com/jakearchibald/idb).

## Stores
- `sessions`: `{ id, meta?, events[], createdAt, updatedAt }`
- `fileHashes`: `{ path, hash, updatedAt }`

```ts
import { saveSession, loadSession, listSessions, deleteSession } from '../src/utils/session-db'

await saveSession('my-id', meta, events)
const rec = await loadSession('my-id')
const all = await listSessions()
await deleteSession('my-id')
```

