import * as React from 'react'
import type useFileLoader from '../hooks/useFileLoader'
import { listSessions, type SessionRecord } from '../db/sessions'

interface Props {
  loader: ReturnType<typeof useFileLoader>
}

export default function SessionTable({ loader }: Props) {
  const [sessions, setSessions] = React.useState<SessionRecord[]>([])
  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState<'Newest' | 'Name'>('Newest')

  React.useEffect(() => {
    listSessions().then(setSessions)
  }, [])

  React.useEffect(() => {
    try {
      // @ts-ignore - provided by preline
      window.HSDatatable?.autoInit?.()
    } catch {}
  }, [sessions])

  const filtered = React.useMemo(() => {
    const t = query.trim().toLowerCase()
    const list = [...sessions]
    if (sort === 'Newest') {
      list.sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id))
    } else {
      list.sort((a, b) => a.id.localeCompare(b.id))
    }
    return t ? list.filter((s) => s.id.toLowerCase().includes(t)) : list
  }, [sessions, query, sort])

  async function handleSelect(id: string) {
    await loader.loadSession(id)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="h-9 px-2 text-sm leading-5 border rounded-md bg-gray-800 border-gray-700 text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="Newest">Newest</option>
          <option value="Name">Name</option>
        </select>
        <input
          id="session-table-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="h-9 px-3 text-sm leading-5 border rounded-md bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-400 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 flex-1"
        />
      </div>
      <div className="relative overflow-auto max-h-96">
        <table
          className="min-w-full divide-y divide-gray-700 text-sm text-left"
          data-hs-datatable='{"search": "#session-table-search"}'
        >
          <thead className="bg-gray-800">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium text-gray-200">ID</th>
              <th scope="col" className="px-3 py-2 font-medium text-gray-200">Updated</th>
              <th scope="col" className="px-3 py-2 font-medium text-gray-200 text-right">Events</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filtered.map((s) => (
              <tr
                key={s.id}
                className="hover:bg-gray-800 cursor-pointer"
                onClick={() => handleSelect(s.id)}
              >
                <td className="px-3 py-2" title={s.id}>{s.id}</td>
                <td className="px-3 py-2">{new Date(s.updatedAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{s.events.length}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-2 text-center text-gray-500">
                  No sessions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
