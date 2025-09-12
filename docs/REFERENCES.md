UI libraries and patterns used

- Park UI / Ark UI
  - Ark UI (React): Component primitives and patterns
  - Park UI: Design tokens, examples, and colors guidance
  - Notes: We follow token-driven styling via `--color-primary` variables and keep components headless where feasible.

- Preline (v2 modules)
  - Packages used: `@preline/tree-view`, `@preline/file-upload`, `@preline/accordion`
  - Behavior: Modules expose UMD globals (e.g., `window.HSTreeView`, `window.HSFileUpload`) and auto-init on `window.load`.
  - SPA tip: For dynamic React mounts, call `HSTreeView.autoInit()` and `HSFileUpload.autoInit()` after component mount.

Dev notes

- We import Preline modules in `src/main.tsx` and also call their `autoInit()` in component `useEffect` to ensure initialization after SPA renders.
- DiffViewer keeps its toolbar sticky. Timeline’s control bar is now sticky with backdrop in `App.tsx`.

