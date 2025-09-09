import * as React from 'react'
import type useFileLoader from '../hooks/useFileLoader'
import { listSessions, deleteSession, type SessionRecord } from '../utils/session-db'
import { Button } from './ui/button'

interface Props {
  loader: ReturnType<typeof useFileLoader>
}

export default function SessionLibrary({ loader }: Props) {
  const [sessions, setSessions] = React.useState<SessionRecord[]>([])
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setSessions(await listSessions())
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  async function handleSave() {
    if (!loader.state.events.length) return
    try {
      await loader.saveSession(name || new Date().toISOString())
      setName('')
      await refresh()
      setError(null)
    } catch (err) {
      console.error(err)
      setError('Failed to save session')
    }
  }

  async function handleLoad(id: string) {
    await loader.loadSession(id)
  }

  async function handleDelete(id: string) {
    try {
      await deleteSession(id)
      await refresh()
      setError(null)
    } catch (err) {
      console.error(err)
      setError('Failed to delete session')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="session name"
          className="h-9 px-3 text-sm leading-5 border rounded-md bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-400 flex-1"
        />
        <Button onClick={handleSave} disabled={!loader.state.events.length}>Save</Button>
      </div>
      {error && <div className="text-sm text-red-500">{error}</div>}
      <div className="max-h-64 overflow-auto divide-y">
        {sessions.map((s) => (
          <div key={s.id} className="py-2 flex items-center gap-2 justify-between">
            <div className="truncate text-sm" title={s.id}>{s.id}</div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => handleLoad(s.id)}>Load</Button>
              <Button size="sm" variant="outline" onClick={() => handleDelete(s.id)}>Delete</Button>
            </div>
          </div>
        ))}
        {sessions.length === 0 && <div className="text-sm text-gray-500 py-2">No saved sessions.</div>}
      </div>
    </div>
  )
}
