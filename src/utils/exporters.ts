import type { ParsedSession } from '../types/session'
import type { ResponseItem } from '../types'
import { downloadText } from './download'
import { toCSV } from '../export/csv'

export function toJson(meta: ParsedSession['meta'] | undefined, events: readonly ResponseItem[]) {
  return JSON.stringify({ meta, events }, null, 2)
}

export function toMarkdown(meta: ParsedSession['meta'] | undefined, events: readonly ResponseItem[]) {
  const lines: string[] = []
  lines.push(`# Session Export${meta?.id ? ` — ${meta.id}` : ''}`)
  if (meta) {
    lines.push('', '## Metadata')
    lines.push(`- id: ${meta.id}`)
    if (meta.timestamp) lines.push(`- timestamp: ${meta.timestamp}`)
    if (meta.version !== undefined) lines.push(`- version: ${meta.version}`)
    if (meta.git) {
      lines.push('- git:')
      if (meta.git.repo) lines.push(`  - repo: ${meta.git.repo}`)
      if (meta.git.branch) lines.push(`  - branch: ${meta.git.branch}`)
      if (meta.git.commit) lines.push(`  - commit: ${meta.git.commit}`)
      if (meta.git.remote) lines.push(`  - remote: ${meta.git.remote}`)
      if (meta.git.dirty !== undefined) lines.push(`  - dirty: ${meta.git.dirty}`)
    }
    if (meta.instructions) {
      lines.push('', '### Instructions', '```', meta.instructions, '```')
    }
  }
  lines.push('', `## Events (${events.length})`)
  events.forEach((ev, idx) => {
    const anyEv = ev as any
    lines.push('', `### ${idx + 1}. ${anyEv.type}${anyEv.at ? ` — ${anyEv.at}` : ''}`)
    switch (ev.type) {
      case 'Message':
        lines.push(`- role: ${ev.role}`, '```', ev.content, '```')
        break
      case 'Reasoning':
        lines.push('```', ev.content, '```')
        break
      case 'LocalShellCall':
        lines.push('```sh', `$ ${ev.command}`, '```')
        if (ev.stdout) lines.push('stdout:', '```', ev.stdout, '```')
        if (ev.stderr) lines.push('stderr:', '```', ev.stderr, '```')
        if (typeof ev.exitCode === 'number') lines.push(`- exitCode: ${ev.exitCode}`)
        if (typeof ev.durationMs === 'number') lines.push(`- durationMs: ${ev.durationMs}`)
        break
      case 'FileChange':
        lines.push(`- path: ${ev.path}`)
        if (ev.diff) lines.push('```diff', ev.diff, '```')
        break
      case 'FunctionCall':
        if (ev.name) lines.push(`- name: ${ev.name}`)
        if (ev.args !== undefined) lines.push('args:', '```json', JSON.stringify(ev.args, null, 2), '```')
        if (ev.result !== undefined) lines.push('result:', '```json', JSON.stringify(ev.result, null, 2), '```')
        break
      case 'WebSearchCall':
        lines.push(`- query: ${ev.query}`)
        if (ev.provider) lines.push(`- provider: ${ev.provider}`)
        if (ev.results?.length) {
          lines.push('', 'Results:')
          ev.results.forEach((r, i) => {
            const title = r.title || r.url || `Result ${i + 1}`
            const url = r.url ? ` (${r.url})` : ''
            lines.push(`- ${title}${url}`)
            if (r.snippet) lines.push(`  - ${r.snippet}`)
          })
        }
        break
      case 'CustomToolCall':
        lines.push(`- tool: ${ev.toolName}`)
        if (ev.input !== undefined) lines.push('input:', '```json', JSON.stringify(ev.input, null, 2), '```')
        if (ev.output !== undefined) lines.push('output:', '```json', JSON.stringify(ev.output, null, 2), '```')
        break
      default:
        lines.push('```json', JSON.stringify(anyEv, null, 2), '```')
    }
  })
  return lines.join('\n')
}

export function exportJson(meta: ParsedSession['meta'] | undefined, events: readonly ResponseItem[], bookmarksOnly: boolean) {
  const name = buildFilename(meta, bookmarksOnly, 'json')
  downloadText(name, toJson(meta, events), 'application/json;charset=utf-8')
}

export function exportMarkdown(meta: ParsedSession['meta'] | undefined, events: readonly ResponseItem[], bookmarksOnly: boolean) {
  const name = buildFilename(meta, bookmarksOnly, 'md')
  downloadText(name, toMarkdown(meta, events), 'text/markdown;charset=utf-8')
}

export function toHtml(meta: ParsedSession['meta'] | undefined, events: readonly ResponseItem[]) {
  const esc = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const pre = (s?: string) => (s ? `<pre>${esc(s)}</pre>` : '')
  const json = (v: unknown) => `<pre>${esc(JSON.stringify(v, null, 2))}</pre>`
  const lines: string[] = []
  lines.push('<!doctype html>')
  lines.push('<html lang="en">')
  lines.push('<head>')
  const title = `Session Export${meta?.id ? ` — ${esc(String(meta.id))}` : ''}`
  lines.push(`<meta charset="utf-8"/><title>${title}</title>`)
  lines.push('<meta name="viewport" content="width=device-width, initial-scale=1"/>')
  lines.push('<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:20px;line-height:1.5;color:#111} h1{font-size:1.5rem} h2{font-size:1.1rem;margin-top:1.25rem} pre{background:#f6f8fa;padding:10px;border-radius:6px;overflow:auto} code{background:#f6f8fa;padding:2px 4px;border-radius:4px} .meta{color:#555} .badge{display:inline-block;padding:2px 6px;border-radius:4px;background:#eef;border:1px solid #ccd;margin-right:6px} .event{border-top:1px solid #eee;padding-top:10px;margin-top:10px}</style>')
  lines.push('</head><body>')
  lines.push(`<h1>${title}</h1>`) 
  if (meta) {
    lines.push('<div class="meta">')
    lines.push('<h2>Metadata</h2>')
    lines.push('<ul>')
    if (meta.id) lines.push(`<li><b>id</b>: <code>${esc(String(meta.id))}</code></li>`) 
    if ((meta as any).timestamp) lines.push(`<li><b>timestamp</b>: <code>${esc(String((meta as any).timestamp))}</code></li>`) 
    if ((meta as any).version !== undefined) lines.push(`<li><b>version</b>: <code>${esc(String((meta as any).version))}</code></li>`) 
    if ((meta as any).git) {
      const g = (meta as any).git
      lines.push('<li><b>git</b>: <ul>')
      if (g.repo) lines.push(`<li>repo: <code>${esc(String(g.repo))}</code></li>`) 
      if (g.branch) lines.push(`<li>branch: <code>${esc(String(g.branch))}</code></li>`) 
      if (g.commit) lines.push(`<li>commit: <code>${esc(String(g.commit))}</code></li>`) 
      if (g.remote) lines.push(`<li>remote: <code>${esc(String(g.remote))}</code></li>`) 
      if (g.dirty !== undefined) lines.push(`<li>dirty: <code>${esc(String(g.dirty))}</code></li>`) 
      lines.push('</ul></li>')
    }
    if ((meta as any).instructions) {
      lines.push('<h2>Instructions</h2>')
      lines.push(pre(String((meta as any).instructions)))
    }
    lines.push('</ul></div>')
  }
  lines.push(`<h2>Events (${events.length})</h2>`) 
  events.forEach((ev, idx) => {
    const anyEv: any = ev
    const at = anyEv.at ? ` — ${esc(String(anyEv.at))}` : ''
    lines.push(`<div class="event"><h3>${idx + 1}. ${esc(anyEv.type)}${at}</h3>`) 
    switch (ev.type) {
      case 'Message':
        lines.push(`<div><span class="badge">${esc(ev.role)}</span>${ev.model ? `<span class="badge">${esc(ev.model)}</span>` : ''}</div>`)
        lines.push(pre(ev.content))
        break
      case 'Reasoning':
        lines.push(pre(ev.content))
        break
      case 'LocalShellCall':
        lines.push(`<div>command: <code>${esc(ev.command)}</code>${ev.cwd ? ` — cwd: <code>${esc(String(ev.cwd))}</code>` : ''}</div>`)
        if (typeof ev.exitCode === 'number') lines.push(`<div>exitCode: <code>${ev.exitCode}</code></div>`) 
        if (typeof ev.durationMs === 'number') lines.push(`<div>durationMs: <code>${ev.durationMs}</code></div>`) 
        if (ev.stdout) lines.push('<div><b>stdout</b></div>', pre(ev.stdout))
        if (ev.stderr) lines.push('<div><b>stderr</b></div>', pre(ev.stderr))
        break
      case 'FileChange':
        lines.push(`<div>path: <code>${esc(String(ev.path))}</code></div>`) 
        if (ev.diff) lines.push('<div><b>diff</b></div>', `<pre>${esc(ev.diff)}</pre>`)
        break
      case 'FunctionCall':
        lines.push(`<div>name: <code>${esc(ev.name)}</code>${typeof ev.durationMs === 'number' ? ` — durationMs: <code>${ev.durationMs}</code>` : ''}</div>`) 
        if (ev.args !== undefined) lines.push('<div><b>args</b></div>', json(ev.args))
        if (ev.result !== undefined) lines.push('<div><b>result</b></div>', json(ev.result))
        break
      case 'WebSearchCall':
        lines.push(`<div>query: <code>${esc(ev.query)}</code>${ev.provider ? ` — provider: <code>${esc(ev.provider)}</code>` : ''}</div>`) 
        if (ev.results?.length) {
          lines.push('<div><b>results</b></div><ul>')
          ev.results.forEach((r, i) => {
            const title = r.title || r.url || `Result ${i + 1}`
            const url = r.url ? ` (<a href="${esc(r.url)}">link</a>)` : ''
            lines.push(`<li>${esc(title)}${url}${r.snippet ? `<div>${esc(r.snippet)}</div>` : ''}</li>`)
          })
          lines.push('</ul>')
        }
        break
      case 'CustomToolCall':
        lines.push(`<div>tool: <code>${esc(ev.toolName)}</code></div>`) 
        if (ev.input !== undefined) lines.push('<div><b>input</b></div>', json(ev.input))
        if (ev.output !== undefined) lines.push('<div><b>output</b></div>', json(ev.output))
        break
      default:
        lines.push(json(anyEv))
    }
    lines.push('</div>')
  })
  lines.push('</body></html>')
  return lines.join('\n')
}

export function exportHtml(meta: ParsedSession['meta'] | undefined, events: readonly ResponseItem[], bookmarksOnly: boolean) {
  const name = buildFilename(meta, bookmarksOnly, 'html')
  downloadText(name, toHtml(meta, events), 'text/html;charset=utf-8')
}

function summarizeFilters(filters?: { type?: string; role?: string; q?: string; pf?: string; other?: boolean }) {
  if (!filters) return ''
  const parts: string[] = []
  if (filters.type && filters.type !== 'All') parts.push(`type_${filters.type}`)
  if (filters.role && filters.role !== 'All') parts.push(`role_${filters.role}`)
  if (filters.q) parts.push(`q_${filters.q.slice(0, 12).replace(/[^a-z0-9-_]/gi, '_')}`)
  if (filters.pf) parts.push(`pf_${filters.pf.slice(0, 12).replace(/[^a-z0-9-_]/gi, '_')}`)
  if (filters.other) parts.push('other')
  return parts.length ? '-' + parts.join('-') : ''
}

export function buildFilename(meta: ParsedSession['meta'] | undefined, bookmarksOnly: boolean, ext: string, filters?: { type?: string; role?: string; q?: string; pf?: string; other?: boolean }) {
  const base = meta?.id ? String(meta.id).replace(/[^a-z0-9-_]/gi, '_').slice(0, 64) : 'session'
  const suffix = (bookmarksOnly ? '-bookmarks' : '') + summarizeFilters(filters)
  return `${base}${suffix}.${ext}`
}

export function exportCsv(meta: ParsedSession['meta'] | undefined, rows: readonly ResponseItem[], bookmarksOnly: boolean, filters?: { type?: string; role?: string; q?: string; pf?: string; other?: boolean }) {
  const name = buildFilename(meta, bookmarksOnly, 'csv', filters)
  downloadText(name, toCSV(rows), 'text/csv;charset=utf-8')
}
