# Changelog

## 2025-09-19 — Two-file diff viewer overhaul

- Added the new `TwoFileDiffViewer` component with optional `leftLabel`,
  `rightLabel`, `leftToRight`, and `defaultMinimized` props to clarify ordering
  and initial window state.
- Retained the legacy `TwoFileDiff` export as a thin wrapper for backwards
  compatibility while exposing the new `exportDiff` helper and type aliases.
- Introduced accessible resizing via `react-resizable-panels`, including
  keyboard-friendly handles, live announcements, and automatic Monaco layout
  updates.
- Implemented export tooling for HTML, Markdown, and unified diff formats with
  metadata + theme toggles based on `diff2html` output.
- Documented keyboard shortcuts, resizing semantics, and export behaviour in
  `docs/diff-viewer.md`, and shipped a demo page
  (`/?demo=two-file-diff`) to preview the variations.
