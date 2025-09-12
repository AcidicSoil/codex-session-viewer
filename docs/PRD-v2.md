<!-- # path: PRD.md -->

# Overview

A local‑first web application to inspect and analyze Codex CLI session recordings. It parses `.jsonl` session files and provides a fast, privacy‑preserving UI to review conversation history, file changes, and tool executions without the Codex runtime.

Primary users: developers, code reviewers, team leads/researchers auditing agentic coding sessions.

Value: instant, offline analysis; high‑signal navigation; rich diffs; filter‑aware exports; simple sharing via deep links or files.

## Core Features (as built)

### Welcome & Session Management

- Open sessions via file picker or drag‑and‑drop.
- Auto‑discovery chips and an “All Sessions” modal list sessions under `/.codex/sessions`, `/sessions`, `/artifacts/sessions` inside the project (build‑time globbing). Content scan marks sessions matching a query (e.g., `apply_patch`).
- IndexedDB Session Library: save, re‑open, and remove sessions; surfaced on the welcome screen.
- Workspace connect (optional): pick a folder via the File System Access API to enable diff tracking and `.codex/sessions` discovery outside the build context.
- Metadata panel shows id, timestamp, git info, and instructions.

### Timeline Visualization & Filters

- Virtualized event stream for large sessions.
- Filters: type (with counts), role (when `Message`), function name chips (including special `apply_patch`), “apply_patch anywhere” toggle, path filter, free‑text search, “Other” toggle.
- Bookmarks with IndexedDB persistence (and one‑time localStorage migration). “Bookmarks only” mode and chips summarize active filters.
- Deep linking: URL hash preserves state, including `b,f,t,r,q,pf,o,ap,gd,fn`.

### Files & Diffs

- File Tree merges: workspace files (when connected), paths from `FileChange` events, and auto‑discovered project files.
- File Preview shows latest modified content from diffs; mismatch markers highlight divergence from workspace.
- Diff Viewer (Monaco) with split/inline and word‑wrap toggles; per‑view theme (auto/light/dark) that honors app theme; guards for very large or binary‑looking diffs.
- Robust diff parsing: handles standard unified diffs and headerless/hunkless `+/-/ ` formats.
- `apply_patch` rendering: parses Codex `apply_patch` envelopes into per‑file operations with status pill; toggle between raw/ rendered per event card.
- Standalone Two‑File Diff tool: compare any two local files from the welcome screen.

### Export & Sharing

- Export modal supports CSV, JSON, Markdown, and standalone HTML.
- Filter‑aware exports: rows match the current filtered dataset; CSV columns are selectable.
- Filenames include timestamp and filter context; downloads via Blob URLs.
- Deep links via URL hash to restore view state.

## User Experience

### Personas

* **Individual Developer:** Reviews own sessions to learn and refactor.
* **Code Reviewer:** Audits decisions and changes across a session.
* **Team Lead / Researcher:** Aggregates insights across many sessions.

### Key User Flows

1. Open Session: Launch → Choose/Drop `.jsonl` → metadata + timeline appear.
2. Investigate Change: Filter by type/role/path/function → jump to file diffs; preview or open full diff.
3. Workspace Review: Connect folder → rescan → changed files list + direct diffs; view mismatches vs. session log.
4. Create Report: Bookmark key events → Export CSV/JSON/Markdown/HTML respecting current filters → share file or deep link.
5. Compare Files: On welcome screen → select two files → view Monaco diff with toggles.

### UI/UX Considerations

* Keyboard navigation across timeline, files, and bookmarks.
* Large-file responsiveness via virtualization and streaming parse.
* Accessible contrasts and semantic regions; diff color-blind safe markers.
* Deep-linkable event selection and preserved filter state in URL.

## Technical Architecture

### Data Layer (TypeScript)

```typescript
interface SessionMeta {
  id: string;
  timestamp: string;
  instructions?: string;
  git?: GitInfo;
}

type ResponseItem =
  | { type: 'Message' | 'FunctionCall' | 'LocalShellCall' | 'Reasoning' | 'WebSearchCall' | 'Other' } & Record<string, unknown>;

interface FileChange {
  path: string;
  diff?: string;
  patches?: string[];
}
interface Artifact {
  name: string;
  path?: string;
  contentType?: string;
  bytes?: Uint8Array;
}
interface ParsedSession {
  meta: SessionMeta;
  events: ResponseItem[];
}
```

### Frontend Stack

- React 18 + TypeScript + Vite
- Zustand for state (theme, filters)
- Tailwind v4 + Headless UI components
- Monaco Editor (lazy‑loaded) for diffs
- IndexedDB via `idb` (sessions, file hashes, settings, bookmarks)

### Runtime & Storage

- Client‑only, runs in browser. No server required for core flows.
- Optional local watch‑log server for telemetry during development (CORS‑enabled; proxied by Vite). Disabled by default.
- IndexedDB stores: `sessions`, `fileHashes`, `settings`, and `bookmarks`.

### File Processing

- Streaming JSONL parser with zod validation and error tolerance.
- Build‑time auto‑discovery of project files/sessions via `import.meta.glob`.
- Workspace Scanner (optional):
  - File System Access API directory pick.
  - Web Worker computes SHA‑256 hashes (WebCrypto) and stores `{ path, hash, mtime }` in IndexedDB.
  - Deltas (added/modified/deleted) derive a ChangeSet and supply before/after content to Diff Viewer.

## Development Roadmap (updated)

Delivered
- Streaming parser + validators; virtualized timeline; event cards.
- Advanced filters (type, role, function name, path, search) with deep links.
- Bookmarks with IndexedDB persistence.
- File Tree + File Preview + robust Diff Viewer (split/inline, wrap, language mapping, guards).
- `apply_patch` parsing and rendering.
- All Sessions view with sorting and content scan; reload button with debounce.
- Session Library surfaced on welcome screen.
- Workspace Scanner with hashing, deltas, and Diff integration.
- Filter‑aware exports (CSV/JSON/Markdown/HTML); filename context.
- Theme Picker (light/dark/system; color tokens) with contrast warnings.
- Local logging hooks + optional dev log server.

Deferred / Future
- Very large export pipeline using a Web Worker.
- Accessibility polish (full audit and keyboard patterns beyond current coverage).
- Packaging as installable npm library + static site publishing workflows.
- Live‑follow mode; plugin API; team collaboration.

## Logical Dependency Chain

1. **Foundations:** JSONL parser → schema guardrails → virtualized timeline.
2. **Usable UI quickly:** Metadata + basic search + file tree + basic diffs.
3. **Depth features:** Filters, bookmarks, command timeline, syntax highlight.
4. **Outputs:** Exporters and artifact extraction.
5. **Scale and polish:** Performance, analytics, plugins, collaboration.

## Risks and Mitigations

- Schema drift: zod validators with tolerant parsing; raw JSON fallback for unknown types.
- Large inputs: streaming parser; virtualization; binary/large diff guards; optional workers (scanner in place).
- Browser FS permissions: clear UI prompts; persisted handles gated by browser; degrade to manual open.
- Privacy: local‑first by default; no network calls except user‑initiated fetch of local dev log endpoint.
- Scope creep: roadmap locked; packaging and collaboration deferred.

## Appendix

## Data Format Compatibility

**Directory layout:**

```txt
.codex/sessions/YYYY/MM/DD/rollout-{timestamp}-{uuid}.jsonl
```

**JSONL expectations:**

* Line 1: `SessionMeta`
* Lines 2+: `ResponseItem` events

**Supported ResponseItem types:** Message, Reasoning, FunctionCall, LocalShellCall, WebSearchCall, CustomToolCall, FileChange, Other.

## Success Metrics

- Parse success rate ≥ 99% across current session logs
- Initial render < 1.5s on typical dev machines
- Timeline interactions ≥ 45fps on 5k‑event sessions
- Diff open < 300ms for text diffs ≤ 1MB; guarded message for larger/binary
- Export verifies row/column counts vs. filters; CSV opens in spreadsheet apps

## Distribution Strategy

- Static Web App (Vercel/Netlify or GitHub Pages)
- Embeddable web component (build emits `dist/element.js`)
- Optional npm library mode (deferred)

## Non‑Goals (current)

- Live session following
- Editing sessions
- Coupling to Codex runtime
- ML‑based insights
- Multi‑user real‑time collaboration

## Key Differences vs Codex‑Integrated

- Independence from Codex runtime/infrastructure
- Modern web‑first UI stack, local‑first operation
- Backward compatibility across session variants; resilient diff handling
- Simple deployment and embedding paths

## Testing & Tooling

- TypeScript strict mode; Vitest (jsdom + node env) with unit and UI smoke tests.
- Tests cover: streaming parser, validators, diff parser and guards, language mapping, hash‑state deep linking, CSV emission, theme store, bookmarks, diff viewer header controls, hook debounce, and two‑file diff SSR.

## Citations and References

- MDN File System Access API, OPFS; SubtleCrypto; Zod; Monaco Editor; IndexedDB patterns.
