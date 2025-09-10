# File System Scanner

This app can index files to power the Files panel and Diff Viewer.

Decision
--------

- Primary access: `showDirectoryPicker()` (File System Access API) with read‑only default and optional `readwrite` when needed.
- Fallback: manual import (drag a `.zip` or session `.jsonl` files) when the API is unavailable or permission is denied.
- OPFS (`navigator.storage.getDirectory()`): used for internal caches only; it does not scan your computer.

Scope and Roots
---------------

- Selected workspace directory (via picker).
- If present within the workspace: `./.codex/sessions`.

Indexing
--------

- A worker walks the directory tree and computes SHA‑256 digests using Web Crypto. Results `{ path, hash, mtime }` are stored in IndexedDB (`fileHashes`).
- Rescan compares a previous snapshot with the latest scan to produce a ChangeSet: `added`, `modified`, `deleted` with counts.

Permissions and Security
------------------------

- Transient user activation is required to pick a directory. Browsers may block access to sensitive/system locations.
- Handles can be persisted in IndexedDB (structured clone) but are origin‑scoped. If permission is revoked, the UI prompts to reconnect.
- No background access without an explicit user action. Clearing site data removes cached hashes and any stored handles.

Browser Support
---------------

- `showDirectoryPicker()` is currently Chromium‑based only. Safari/Firefox users will see the fallback (manual import).
- OPFS is widely available for origin‑private storage.

Privacy Notes
-------------

- Hashes and relative paths remain local to your browser (IndexedDB). They may reveal filenames and change frequency. Clear site data to remove.

Errors and Recovery
-------------------

- Permission denied → explain why access is needed and offer fallback import.
- Revoked handle → show reconnect prompt; retain previous snapshot for diff until replaced.

References
----------

- MDN File System API, `showDirectoryPicker()`, `StorageManager.getDirectory()`.
- MDN SubtleCrypto `digest()`.
- See also: [Workspace Scanning — PoC](./scanner-poc.md) for a minimal runnable example.
