import type { ResponseItem } from '../types'

export function normalize(q: string) {
  return q.trim().toLowerCase()
}

export function eventText(ev: ResponseItem): string {
  switch (ev.type) {
    case 'Message':
      const msg = typeof ev.content === 'string'
        ? ev.content
        : ev.content.map((p) => ('text' in p ? String((p as any).text) : '')).join('\n')
      return [ev.role, ev.model || '', msg].join('\n')
    case 'Reasoning':
      return ev.content || ''
    case 'LocalShellCall':
      return [ev.command, ev.cwd || '', ev.stdout || '', ev.stderr || ''].join('\n')
    case 'FunctionCall':
      return [ev.name, JSON.stringify(ev.args ?? ''), JSON.stringify(ev.result ?? '')].join('\n')
    case 'WebSearchCall':
      return [ev.query, ev.provider || '', JSON.stringify(ev.results ?? '')].join('\n')
    case 'CustomToolCall':
      return [ev.toolName, JSON.stringify(ev.input ?? ''), JSON.stringify(ev.output ?? '')].join('\n')
    case 'FileChange':
      return [ev.path, ev.diff || ''].join('\n')
    default:
      return JSON.stringify(ev as any)
  }
}

export function matchesEvent(ev: ResponseItem, query: string): boolean {
  const q = normalize(query)
  if (!q) return true
  const text = eventText(ev).toLowerCase()
  return text.includes(q)
}

