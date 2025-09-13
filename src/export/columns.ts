import type { ResponseItem } from '../types'

export type FieldType = 'string' | 'number' | 'boolean' | 'json'

export interface ColumnMeta {
  key: string
  label: string
  type: FieldType
  extractor: (ev: ResponseItem, index: number) => unknown
}

export const COLUMN_CATALOG: ColumnMeta[] = [
  { key: 'index', label: 'index', type: 'number', extractor: (_ev, i) => i },
  { key: 'at', label: 'at', type: 'string', extractor: (ev: any) => ev.at },
  { key: 'type', label: 'type', type: 'string', extractor: (ev: any) => ev.type },
  { key: 'role', label: 'role', type: 'string', extractor: (ev: any) => ev.role },
  { key: 'model', label: 'model', type: 'string', extractor: (ev: any) => ev.model },
  { key: 'path', label: 'path', type: 'string', extractor: (ev: any) => ev.path },
  { key: 'command', label: 'command', type: 'string', extractor: (ev: any) => ev.command },
  { key: 'name', label: 'name', type: 'string', extractor: (ev: any) => ev.name },
  { key: 'content', label: 'content', type: 'string', extractor: (ev: any) => (typeof ev.content === 'string'
      ? ev.content
      : Array.isArray(ev.content)
        ? ev.content.map((p: any) => ('text' in p ? String(p.text) : '')).join('\n')
        : undefined) },
  { key: 'diff', label: 'diff', type: 'string', extractor: (ev: any) => (typeof ev.diff === 'string' ? ev.diff : undefined) },
  { key: 'args', label: 'args', type: 'json', extractor: (ev: any) => ev.args },
  { key: 'result', label: 'result', type: 'json', extractor: (ev: any) => ev.result },
]

export const DEFAULT_COLUMN_KEYS = ['index','at','type','role','model','path','command','name','content','diff']

export function resolveColumns(selectedKeys?: string[]): ColumnMeta[] {
  const keys = selectedKeys && selectedKeys.length ? selectedKeys : DEFAULT_COLUMN_KEYS
  const byKey = Object.fromEntries(COLUMN_CATALOG.map((c) => [c.key, c])) as Record<string, ColumnMeta>
  return keys
    .map((k) => byKey[k])
    .filter((c): c is ColumnMeta => Boolean(c))
}
