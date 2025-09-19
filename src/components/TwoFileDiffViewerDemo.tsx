import * as React from 'react'
import TwoFileDiffViewer from './TwoFileDiffViewer'
import { Button } from './ui/button'

const baselineSample = {
  name: 'feature.ts',
  content:
    "export function getUser(id: string) {\n" +
    "  if (!id) {\n" +
    "    throw new Error('missing id')\n" +
    '  }\n' +
    "  return fetch(`/api/users/\\${id}`).then((res) => res.json())\n" +
    '}\n',
}

const proposedSample = {
  name: 'feature.ts',
  content:
    'export async function getUser(id: string, signal?: AbortSignal) {\n' +
    '  if (!id) {\n' +
    "    throw new Error('missing id')\n" +
    '  }\n' +
    "  const response = await fetch(`/api/users/\\${id}`, { signal })\n" +
    '  if (!response.ok) {\n' +
    "    throw new Error('User lookup failed')\n" +
    '  }\n' +
    '  return response.json()\n' +
    '}\n',
}

const swappedBaseline = {
  name: 'legacy.css',
  content: `body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
}
`,
}

const swappedProposed = {
  name: 'legacy.css',
  content: `:root {
  color-scheme: light dark;
}
body {
  margin: 0;
  padding: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}
`,
}

const compactBaseline = {
  name: 'README.md',
  content: `# Old readme\n\nSome quick notes.\n`,
}

const compactProposed = {
  name: 'README.md',
  content: `# Updated readme\n\nWe now document keyboard shortcuts and export paths.\n`,
}

const exportSample = {
  name: 'api.ts',
  content: `export interface ApiRequest {\n  id: string\n  body?: unknown\n}\n`,
}

const exportSampleNew = {
  name: 'api.ts',
  content: `export interface ApiRequest {\n  id: string\n  body?: unknown\n  /** optional request correlation id */\n  correlationId?: string\n}\n`,
}

export default function TwoFileDiffViewerDemo() {
  const [now] = React.useState(() => new Date().toLocaleString())
  const docsHref = 'https://github.com/AcidicSoil/codex-session-viewer/blob/main/docs/diff-viewer.md'
  return (
    <div className="min-h-screen bg-slate-900 px-6 py-10 text-slate-50">
      <header className="mx-auto mb-10 max-w-5xl space-y-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">codex session viewer</p>
        <h1 className="text-3xl font-semibold">Two-file diff viewer showcase</h1>
        <p className="text-sm text-slate-300">
          Rendered at {now}. Drop new files into any card to test interactive behaviour. Use the
          export controls to download HTML, Markdown, or unified patches.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="sm" variant="secondary" onClick={() => window.open(docsHref, '_blank')?.focus?.()}>
            View documentation
          </Button>
          <Button size="sm" variant="outline" onClick={() => (window.location.href = '/?')}>
            Exit demo
          </Button>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-12 pb-20">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">1. Default layout</h2>
          <p className="text-sm text-slate-300">
            Baseline on the left, proposed change on the right. Resize the metadata panel or toggle
            export options.
          </p>
          <TwoFileDiffViewer
            initialLeftFile={baselineSample}
            initialRightFile={proposedSample}
            orderNoticeHref={docsHref}
          />
        </section>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">2. Swapped orientation</h2>
          <p className="text-sm text-slate-300">
            Start with the change on the left by passing <code>{'leftToRight={false}'}</code>.
          </p>
          <TwoFileDiffViewer
            initialLeftFile={swappedBaseline}
            initialRightFile={swappedProposed}
            leftToRight={false}
          />
        </section>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">3. Expanded workspace</h2>
          <p className="text-sm text-slate-300">The viewer boots in expanded mode for long edits.</p>
          <TwoFileDiffViewer
            initialLeftFile={compactBaseline}
            initialRightFile={compactProposed}
            defaultExpanded
          />
        </section>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">4. Minimized start</h2>
          <p className="text-sm text-slate-300">
            Useful when embedding multiple diffs in a dense dashboard. Activate the header controls to
            restore.
          </p>
          <TwoFileDiffViewer
            initialLeftFile={compactBaseline}
            initialRightFile={compactProposed}
            defaultMinimized
          />
        </section>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">5. Export-focused</h2>
          <p className="text-sm text-slate-300">
            Metadata toggles default to enabled so testers can exercise every export format quickly.
          </p>
          <TwoFileDiffViewer
            initialLeftFile={exportSample}
            initialRightFile={exportSampleNew}
            leftLabel="Main branch"
            rightLabel="Feature branch"
            defaultExpanded
          />
        </section>
      </main>
    </div>
  )
}

