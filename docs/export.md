# Export Specification (v0)

Goal: allow users to export exactly what they are viewing, respecting active filters and scope, with granular field/column selection. Formats: CSV, JSON (existing), Markdown (existing), HTML (existing).

Scope options

- All filtered events
- Current page (viewport) — optional, defaults to all filtered
- Bookmarked only (existing toggle)

Default fields (CSV)

- index (absolute index in input stream)
- at (timestamp if present, derived with `parseTimestampFromPath` when exported from paths)
- type (Message | Reasoning | FileChange | FunctionCall | LocalShellCall | WebSearchCall | CustomToolCall | Other)
- role (Message only)
- model (Message only)
- path (FileChange only)
- command (LocalShellCall only)
- name (FunctionCall only)
- content (Message/Reasoning — trimmed; multi-line preserved)
- diff (FileChange — unified diff)

Flattening/formatting

- Nested objects (args/result/results) are serialized as JSON strings.
- Newlines are preserved inside CSV fields using RFC4180 quoting: double quotes wrap and internal quotes doubled.
- Dates: leave as-is; consumer formats if needed.

Filename pattern

- "${sessionId || 'session'}${bookmarks? '-bookmarks':''}${filtersSuffix}.${ext}"
- "filtersSuffix" summarizes type/role/search/path filters, e.g. "-type_Message-role_user-q_bug-pf_src".

Performance

- For <5k rows: main thread generation.
- For larger: Web Worker path (planned — v0 inlines main thread).

Accessibility/UX

- Modal presents format, scope, and fields list (checklist) with estimated row count.
- While generating, disable action and show progress spinner.

Validation

- CSV opens in spreadsheet apps. JSON validates. Row/column counts match selection.
