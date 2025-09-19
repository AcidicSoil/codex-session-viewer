# Two-file diff viewer

The upgraded two-file diff viewer pairs the existing Monaco-based renderer with
explicit file ordering, export tooling, and an accessible resizable layout.

## File order

- The **left side** is treated as the baseline by default and inherits the
  `leftLabel` prop (defaults to “Baseline”).
- The **right side** is the proposed change (`rightLabel`, default “Proposed
  change”).
- The chrome surfaces a persistent order notice explaining the semantics. Users
  can dismiss it per session.
- Use **Swap sides** to reverse direction; both the Monaco view and metadata
  panel update immediately.

## Loading files

- Drop one or two text-like files anywhere on the drop zone. The component
  accepts text MIME types plus common code extensions.
- The “Choose Baseline / Proposed change” buttons open native pickers if drag
  and drop is inconvenient or unavailable.
- Dropping two files fills both slots; dropping one file replaces the next open
  slot.

## Window controls

- The diff viewport auto-sizes to the taller editor content and grows as files
  change. Extremely tall diffs clamp to ~85% of the viewport height and enable
  outer scrolling.
- **Minimize** collapses the body to the header so the viewer can be tucked
  away in crowded layouts. Restoring re-opens the last layout.

## Resizing & accessibility

- The diff and metadata panes live inside a `react-resizable-panels`
  `PanelGroup`. The handle exposes `aria-label="Resize diff viewer"`, focuses
  with a visible ring, and responds to keyboard arrows (handled by the
  underlying library).
- `useResizeObserver` publishes viewer dimensions to a polite live region for
  assistive technology. Metadata cards surface the same measurements.

## Export options

- Invoke the **Export** button for HTML, Markdown, or unified diff output.
- HTML exports use `diff2html` plus inline styles. Markdown wraps the unified
  patch in fenced code blocks. Unified format optionally prefixes metadata with
  comment lines.
- Exports respect `includeMetadata` and `theme` (light/dark) toggles and stream
  through the shared `downloadText` helper for filename parity.

## Keyboard cheatsheet

- `Enter`/`Space` on the drop zone opens the next picker.
- `Alt + Arrow` keys on the splitter adjust panel sizes (handled by
  `react-resizable-panels`).
- `Tab` cycles through controls in the header, metadata toggles, and live
  handle.

## Demo page

Run the Vite dev server (`npm run dev`) and open
`http://localhost:5173/?demo=two-file-diff` to explore:

1. Default drop flow and notice
2. Swapped orientation
3. Auto-sized layout
4. Resizable metadata panel
5. Export presets

Each scenario preloads sample files illustrating the new behaviour.
