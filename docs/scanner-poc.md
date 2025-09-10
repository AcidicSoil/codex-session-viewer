# Workspace Scanning — Proof of Concept

This PoC shows: connecting a workspace via the File System Access API, hashing files in a worker, computing a ChangeSet, listing changed files, loading workspace sessions, and opening a diff against the current disk content.

## Prerequisites

- Chromium-based browser, served over HTTPS or localhost (secure context).
- FS Access availability for `showDirectoryPicker()`; otherwise see Fallbacks.

## Flow

1. Connect Workspace (user activation prompts the directory picker).
2. Rescan: a worker recursively hashes files and stores `{ path, hash, mtime }` in IndexedDB.
3. Build ChangeSet (added/modified/deleted) from previous snapshot → UI list.
4. Workspace Sessions: if `./.codex/sessions/**/*.{jsonl,ndjson,json}` exists, offer one-click load.
5. Open Diff: for a changed file, show before/after when baseline is available from session, otherwise show current file content as the "after" side.

## Permissions & Security

- Directory selection requires transient user activation. Browsers may block sensitive locations.
- Handles can be persisted via structured clone in IndexedDB; permissions are origin-scoped and revocable.
- No background access without explicit user action. Clear site data to remove hashes and handles.

## PoC Snippet

```ts
import { startFileSystemScanFromHandle } from '../src/utils/fs-scanner'
import { listHashes } from '../src/utils/session-db'
import { buildChangeSet } from '../src/scanner/diffIndex'

let workspace: FileSystemDirectoryHandle | null = null

async function connect() {
  // @ts-ignore experimental
  workspace = await (window as any).showDirectoryPicker?.({ id: 'workspace', mode: 'read' })
}

async function rescan() {
  if (!workspace) return
  const before = await listHashes()
  const runner = startFileSystemScanFromHandle(workspace)
  await new Promise<void>((resolve) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data === 'done' || e.data === 'aborted') {
        runner.worker.removeEventListener('message', onMsg as any)
        resolve()
      }
    }
    runner.worker.addEventListener('message', onMsg as any)
  })
  const after = await listHashes()
  return buildChangeSet(before, after)
}
```

## Fallbacks

- Drag-and-drop: read handles via `DataTransferItem.getAsFileSystemHandle()` during `drop` (same tick).
- Manual import: drop `.jsonl`/`.ndjson` session files or a zip archive.

## Privacy

- Paths + SHA-256 digests are stored locally in IndexedDB. Clear site data to remove.

## References

- File System API & Directory Picker; Permissions (`requestPermission`) and OPFS root (`navigator.storage.getDirectory()`).
- Drag/drop handles (`DataTransferItem.getAsFileSystemHandle()`).
- idb README for IndexedDB patterns.

