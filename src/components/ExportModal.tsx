import * as React from 'react'
import { Dialog } from '@headlessui/react'
import type { ParsedSession } from '../types/session'
import type { ResponseItem } from '../types'
import { Button } from './ui/button'
import { COLUMN_CATALOG, DEFAULT_COLUMN_KEYS, resolveColumns } from '../export/columns'
import { toCsvFieldSpec } from '../export/fieldSelection'
import { toCSV } from '../export/csv'
import { exportJson, exportMarkdown, exportHtml, buildFilename } from '../utils/exporters'

export interface ExportModalProps {
  open: boolean
  onClose: () => void
  meta: ParsedSession['meta'] | undefined
  items: readonly ResponseItem[]
  filters?: { type?: string; role?: string; q?: string; pf?: string; other?: boolean }
  defaultKeys?: string[]
}

export default function ExportModal({ open, onClose, meta, items, filters, defaultKeys }: ExportModalProps) {
  const [format, setFormat] = React.useState<'csv' | 'json' | 'markdown' | 'html'>('csv')
  const [keys, setKeys] = React.useState<string[]>(defaultKeys ?? DEFAULT_COLUMN_KEYS)

  React.useEffect(() => {
    if (open) {
      setFormat('csv')
      setKeys(defaultKeys ?? DEFAULT_COLUMN_KEYS)
    }
  }, [open, defaultKeys])

  function handleExport() {
    const name = buildFilename(meta, false, format, filters)
    if (format === 'json') return exportJson(meta, items, false)
    if (format === 'markdown') return exportMarkdown(meta, items, false)
    if (format === 'html') return exportHtml(meta, items, false)
    const columns = resolveColumns(keys)
    const csv = toCSV(items, toCsvFieldSpec(columns))
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-xl rounded bg-white p-4">
          <Dialog.Title className="text-lg font-semibold mb-2">Export</Dialog.Title>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm w-24">Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value as any)} className="h-9 px-3 text-sm leading-5 border rounded-md bg-gray-800 border-gray-700 text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500">
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="markdown">Markdown</option>
                <option value="html">HTML</option>
              </select>
            </div>
            {format === 'csv' && (
              <div>
                <div className="text-sm font-medium mb-1">Fields</div>
                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-auto border rounded p-2">
                  {COLUMN_CATALOG.map((c) => (
                    <label key={c.key} className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={keys.includes(c.key)} onChange={(e) => {
                        setKeys((prev) => {
                          const set = new Set(prev)
                          if (e.target.checked) set.add(c.key)
                          else set.delete(c.key)
                          return Array.from(set)
                        })
                      }} />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="text-sm text-gray-600">Rows to export: {items.length}</div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button variant="secondary" size="sm" onClick={handleExport}>Export</Button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
