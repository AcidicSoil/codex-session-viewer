import { useCallback, useMemo, useReducer } from 'react'
import { streamParseSession, type ParserError } from '../parser'
import { saveSession as dbSave, loadSession as dbLoad } from '../utils/session-db'

export type LoadPhase = 'idle' | 'parsing' | 'error' | 'success'

import type { SessionMetaParsed } from '../parser'

import type { ResponseItemParsed } from '../parser'

interface State {
  phase: LoadPhase
  meta?: SessionMetaParsed
  events: ResponseItemParsed[]
  ok: number
  fail: number
  lastError?: ParserError
}

type Action =
  | { type: 'reset' }
  | { type: 'start' }
  | { type: 'meta'; meta: SessionMetaParsed }
  | { type: 'event'; event: ResponseItemParsed }
  | { type: 'ingest'; events: ResponseItemParsed[]; meta?: SessionMetaParsed }
  | { type: 'fail'; error: ParserError }
  | { type: 'done' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return { phase: 'idle', meta: undefined, events: [], ok: 0, fail: 0 }
    case 'start':
      return { phase: 'parsing', meta: undefined, events: [], ok: 0, fail: 0 }
    case 'meta':
      return { ...state, meta: action.meta }
    case 'event':
      return { ...state, ok: state.ok + 1, events: [...state.events, action.event] }
    case 'fail':
      return { ...state, fail: state.fail + 1, lastError: action.error }
    case 'ingest':
      return { phase: 'success', meta: action.meta, events: action.events, ok: action.events.length, fail: 0 }
    case 'done':
      return { ...state, phase: 'success' }
    default:
      return state
  }
}

export function useFileLoader() {
  const [state, dispatch] = useReducer(reducer, { phase: 'idle', meta: undefined, events: [], ok: 0, fail: 0 })

  const start = useCallback(async (file: File) => {
    dispatch({ type: 'start' })
    try {
      for await (const item of streamParseSession(file, { maxErrors: 100 })) {
        if (item.kind === 'meta') dispatch({ type: 'meta', meta: item.meta })
        else if (item.kind === 'event') dispatch({ type: 'event', event: item.event })
        else if (item.kind === 'error') dispatch({ type: 'fail', error: item.error })
      }
      dispatch({ type: 'done' })
    } catch (e) {
      // If something unexpected happens, surface as a fail
      dispatch({ type: 'fail', error: {
        line: -1,
        reason: 'invalid_schema',
        message: (e as Error)?.message ?? 'Unknown error',
        raw: ''
      } as ParserError })
    }
  }, [])

  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  const progress = useMemo(() => {
    const total = state.ok + state.fail
    return { total, ok: state.ok, fail: state.fail }
  }, [state.ok, state.fail])

  const ingest = useCallback((events: ResponseItemParsed[], meta?: SessionMetaParsed) => {
    dispatch({ type: 'ingest', events, meta })
  }, [])

  const saveSession = useCallback(async (id: string) => {
    await dbSave(id, state.meta, state.events)
  }, [state.meta, state.events])

  const loadSession = useCallback(async (id: string) => {
    const rec = await dbLoad(id)
    if (rec) ingest(rec.events, rec.meta)
  }, [ingest])

  return { state, progress, start, reset, ingest, saveSession, loadSession }
}

export default useFileLoader
