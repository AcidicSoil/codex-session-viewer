import type { ColumnMeta } from './columns'
import type { CsvField } from './csv'

export function toggleKey(keys: string[], key: string): string[] {
  const set = new Set(keys)
  if (set.has(key)) set.delete(key)
  else set.add(key)
  return Array.from(set)
}

export function toCsvFieldSpec(columns: ColumnMeta[]): CsvField[] {
  return columns.map((c) => ({
    key: c.key,
    label: c.label,
    // ColumnMeta.extractor returns unknown; CSV extractor expects primitives/null/undefined.
    // We allow unknown here and let toCSV handle object stringification.
    extractor: (ev, index) => c.extractor(ev, index) as any,
  }))
}
