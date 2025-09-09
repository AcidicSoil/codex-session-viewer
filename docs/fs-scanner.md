# File System Scanner

The viewer runs a background worker that indexes local files to speed up diffing and session discovery.

## Indexed Roots

- **Current working directory** – the origin's root directory provided by the File System Access API.
- **`.codex/sessions`** – if present, this folder is scanned to list session logs.

Each file found under these roots is read and hashed with SHA-256. The resulting `{ path, hash }` pairs are stored in IndexedDB via the `fileHashes` store in `src/utils/session-db.ts`.

## Privacy Notes

The hashes never leave your browser, but they persist in IndexedDB. Because file paths and content digests are retained, they may reveal information about your project. Clear site data if you don't want this information stored locally.
