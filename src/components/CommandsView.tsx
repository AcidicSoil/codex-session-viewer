import * as React from 'react'
import type { ResponseItem } from '../types'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Button } from './ui/button'
import { downloadText } from '../utils/download'

export interface CommandRow {
  idx: number
  at?: string | number
  command: string
  cwd?: string
  exitCode?: number
  durationMs?: number
  stdout?: string
  stderr?: string
}

export function CommandsView({
  events,
  onJumpToIndex,
}: {
  events: readonly ResponseItem[]
  onJumpToIndex: (idx: number) => void
}) {
  const commands = React.useMemo<CommandRow[]>(() => {
    const rows: CommandRow[] = []
    events.forEach((ev, i) => {
      if ((ev as any).type === 'LocalShellCall') {
        const e = ev as Extract<ResponseItem, { type: 'LocalShellCall' }>
        rows.push({
          idx: i,
          at: (e as any).at,
          command: e.command,
          cwd: e.cwd as any,
          exitCode: e.exitCode,
          durationMs: e.durationMs,
          stdout: e.stdout,
          stderr: e.stderr,
        })
      }
    })
    return rows
  }, [events])

  const [q, setQ] = React.useState('')
  const [exit, setExit] = React.useState<'All' | 'Success' | 'Failed'>('All')
  const [minMs, setMinMs] = React.useState<string>('')

  const filtered = React.useMemo(() => {
    const n = (s?: string) => (s ?? '').toLowerCase()
    const qq = q.trim().toLowerCase()
    const thr = parseInt(minMs || '0', 10) || 0
    return commands.filter((r) => {
      if (exit === 'Success' && r.exitCode !== 0) return false
      if (exit === 'Failed' && r.exitCode === 0) return false
      if (thr && (r.durationMs || 0) < thr) return false
      if (!qq) return true
      const text = [r.command, r.cwd || '', String(r.exitCode ?? ''), String(r.durationMs ?? ''), r.stdout || '', r.stderr || '']
        .join('\n')
        .toLowerCase()
      return text.includes(qq)
    })
  }, [commands, q, exit, minMs])

  function exportJson() {
    const payload = filtered.map(({ idx, ...rest }) => ({ index: idx + 1, ...rest }))
    downloadText('commands.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8')
  }

  function exportCsv() {
    const header = ['index', 'at', 'command', 'cwd', 'exitCode', 'durationMs']
    const rows = filtered.map((r) => [String(r.idx + 1), String(r.at ?? ''), JSON.stringify(r.command), JSON.stringify(r.cwd ?? ''), String(r.exitCode ?? ''), String(r.durationMs ?? '')])
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n')
    downloadText('commands.csv', csv, 'text/csv;charset=utf-8')
  }

  if (commands.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Commands</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search commands…"
            className="h-9 px-3 text-sm leading-5 border rounded-md bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-400 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label="Search commands"
          />
          <select
            value={exit}
            onChange={(e) => setExit(e.target.value as any)}
            className="h-9 px-3 text-sm leading-5 border rounded-md bg-gray-800 border-gray-700 text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label="Exit code filter"
          >
            {(['All', 'Success', 'Failed'] as const).map((t) => (
              <option value={t} key={t}>{t}</option>
            ))}
          </select>
          <input
            value={minMs}
            onChange={(e) => setMinMs(e.target.value)}
            placeholder="Min ms"
            className="h-9 px-3 text-sm leading-5 border rounded-md w-28 bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-400 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label="Min duration in ms"
            inputMode="numeric"
            pattern="[0-9]*"
          />
          <Button variant="outline" size="default" onClick={() => { setQ(''); setExit('All'); setMinMs('') }}>Clear</Button>
          <div className="relative">
            <details className="[&_summary::-webkit-details-marker]:hidden">
              <summary className="h-9 px-3 text-sm leading-5 rounded-md cursor-pointer select-none bg-teal-600 text-white hover:bg-teal-500">Export ▾</summary>
              <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border bg-white shadow">
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={exportCsv}>CSV</button>
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={exportJson}>JSON</button>
              </div>
            </details>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Time</th>
                <th className="py-1 pr-2">Command</th>
                <th className="py-1 pr-2">cwd</th>
                <th className="py-1 pr-2">exit</th>
                <th className="py-1 pr-2">ms</th>
                <th className="py-1 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.idx} className="align-top border-b last:border-0">
                  <td className="py-1 pr-2">{r.idx + 1}</td>
                  <td className="py-1 pr-2 text-gray-500">{formatAt(r.at)}</td>
                  <td className="py-1 pr-2">
                    <code className="bg-gray-100 rounded px-1.5 py-0.5 inline-block max-w-[420px] break-all">{r.command}</code>
                    {(r.stdout || r.stderr) && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-gray-500">output</summary>
                        {r.stdout && <pre className="bg-gray-50 rounded p-2 mt-1 whitespace-pre-wrap max-h-40 overflow-auto">{r.stdout}</pre>}
                        {r.stderr && <pre className="bg-red-50 rounded p-2 mt-1 whitespace-pre-wrap max-h-40 overflow-auto">{r.stderr}</pre>}
                      </details>
                    )}
                  </td>
                  <td className="py-1 pr-2"><code className="bg-gray-50 rounded px-1.5 py-0.5">{r.cwd}</code></td>
                  <td className="py-1 pr-2">{r.exitCode ?? ''}</td>
                  <td className="py-1 pr-2">{r.durationMs ?? ''}</td>
                  <td className="py-1 pr-2">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(r.command)}>Copy</Button>
                      <Button variant="outline" size="sm" onClick={() => onJumpToIndex(r.idx)}>Jump</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function formatAt(at?: string | number) {
  if (!at) return ''
  try {
    const d = new Date(at)
    return isNaN(d.getTime()) ? String(at) : d.toLocaleString()
  } catch {
    return String(at)
  }
}

export default CommandsView
