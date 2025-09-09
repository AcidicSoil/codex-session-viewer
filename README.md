Codex Session Viewer
====================

A lightweight UI to inspect Codex CLI session logs. Includes:

- Virtualized timeline of events
- File tree derived from `FileChange` events
- Monaco-based Diff Viewer (lazy-loaded)
- Export to JSON/Markdown
- Bookmarks with IndexedDB persistence (and migration from localStorage)
- Session Library to save, load, and delete sessions
- File System scanner that hashes project files via File System Access API

Getting Started
---------------

- Install deps:

  npm install

- Dev server:

  npm run dev

Usage
-----

- Open a session: use “Choose .jsonl” or drag + drop a `.jsonl`/`.ndjson` file.
- Auto‑detected sessions: the app lists any logs found under `/.codex/sessions`, `/sessions`, or `/artifacts/sessions` inside the repo. Click a chip to load one.
- All Sessions: click “View all (N)” to see every detected session with search, copy path, raw open, and Load actions.
- Files panel: shows paths from both `FileChange` events and auto‑discovered project files (see below). Select a file to preview its latest change and open a full diff.

Diff Viewer
-----------

- The Diff Viewer uses `@monaco-editor/react` + `monaco-editor`, which are listed in `package.json`.
- It is lazy-loaded at runtime. If the modules are not yet installed, a plain fallback view is shown.
- Open it from any `FileChange` card via the “Open diff” button.

Notes
-----

- The file tree ignores leading `./` and `/` and normalizes Windows paths.
- Auto‑discovered project files: at build time we enumerate common source locations (e.g. `src/**`, `scripts/**`, `public/**`, plus a few root files). This augments the file tree even if your session has few or no `FileChange` events.
- Auto‑detected sessions: during dev/build, files under `/.codex/sessions/**/*.{jsonl,ndjson,json}` (and `/sessions`, `/artifacts/sessions`) are discovered and listed. This only works for files that live inside the Vite project root; the app does not scan your filesystem at runtime. A separate File System scanner is available to index directories on demand; see [docs/fs-scanner.md](docs/fs-scanner.md).
 - If you have many sessions, use “View all (N)” for a searchable list; chips only show the first 12 for quick access.
- URL hash preserves the “bookmarks only” toggle (`b=1`) and selected file (`f=path`).
- URL hash also preserves optional filters when set: type (`t=<TypeFilter>`), role (`r=user|assistant|system`).

Bookmarks
---------

- Toggle a bookmark on any event using the star icon on its card.
- Bookmarks persist to IndexedDB (`db: csv`, store `bookmarks`) and also mirror to `localStorage` for backward compatibility.
- On first load, any existing `localStorage` bookmarks are migrated to IndexedDB.
- The Timeline toolbar has a toggle to show only bookmarked items and a count of current bookmarks. Clearing bookmarks removes them from both stores.

Session Library
---------------

Use the Session Library to persist parsed sessions to IndexedDB for later retrieval. See [docs/session-library.md](docs/session-library.md) for details.
The underlying database schema is documented in [docs/session-db.md](docs/session-db.md).

Export (JSON / Markdown / HTML)
-------------------------------

- Use the “Export JSON”, “Export Markdown”, or “Export HTML” buttons in the Timeline toolbar.
- JSON export shape: `{ meta, events }`, where `meta` is the parsed session metadata and `events` is the filtered list in current view.
- Exports respect the “Bookmarks only” toggle. When active, only bookmarked events are exported and a `-bookmarks` suffix is added to the filename.
- Filenames are derived from `meta.id` when available (sanitized to `[a-z0-9-_]`), otherwise `session.json` / `session.md`.
- Downloads are created via `Blob` + `URL.createObjectURL` and the `download` attribute on an anchor.
- HTML export is a standalone page with minimal CSS and does not require external assets.

Filters
-------

- Type filter now shows counts for each event type and includes a combined `ToolCalls` option covering Function/LocalShell/WebSearch/Custom.
- When `Message` is selected, a secondary role filter appears (`user`, `assistant`, `system`) with counts.
- Clear filters resets search, type, role, and bookmarks-only toggle.

Commands View
-------------

- Dedicated table of `LocalShellCall` events with search, exit status filter, and min-duration filter.
- Actions per row: Copy command, Jump to event in the main timeline, expand to view stdout/stderr.
- Export visible rows as CSV or JSON.
