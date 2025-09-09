# File System Scanner

Uses the File System Access API in a Web Worker to hash files in the current directory and `.codex/sessions`.

- Hashes are stored in IndexedDB `fileHashes` store.
- Intended to avoid re-reading unchanged files.
- Be mindful of privacy when granting directory access.

