import type { ResponseItem } from '../types'

export interface CsvField {
  key: string
  label: string
  extractor: (ev: ResponseItem, index: number) => string | number | boolean | null | undefined
}

export const defaultCsvFields: CsvField[] = [
  { key: 'index', label: 'index', extractor: (_ev, i) => i },
  { key: 'at', label: 'at', extractor: (ev: any) => ev.at },
  { key: 'type', label: 'type', extractor: (ev: any) => ev.type },
  { key: 'role', label: 'role', extractor: (ev: any) => ev.role },
  { key: 'model', label: 'model', extractor: (ev: any) => ev.model },
  { key: 'path', label: 'path', extractor: (ev: any) => ev.path },
  { key: 'command', label: 'command', extractor: (ev: any) => ev.command },
  { key: 'name', label: 'name', extractor: (ev: any) => ev.name },
  {
    key: 'content',
    label: 'content',
    extractor: (ev: any) => (typeof ev.content === 'string' ? ev.content : undefined),
  },
  {
    key: 'diff',
    label: 'diff',
    extractor: (ev: any) => (typeof ev.diff === 'string' ? ev.diff : undefined),
  },
]

function quoteCsv(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s === '') return ''
  const needsQuote = /[",\n\r]/.test(s)
  const escaped = s.replace(/"/g, '""')
  return needsQuote ? `"${escaped}"` : escaped
}

export function toCSV(rows: readonly ResponseItem[], fields: CsvField[] = defaultCsvFields): string {
  const header = fields.map((f) => quoteCsv(f.label)).join(',')
  const lines: string[] = [header]
  rows.forEach((ev, i) => {
    const cols = fields.map((f) => {
      let v = f.extractor(ev, i)
      // Stringify non-Date objects; keep primitives and Dates as-is
      if (v && typeof v === 'object' && Object.prototype.toString.call(v) !== '[object Date]') {
        try { v = JSON.stringify(v) } catch {}
      }
      return quoteCsv(v)
    })
    lines.push(cols.join(','))
  })
  return lines.join('\n')
}
