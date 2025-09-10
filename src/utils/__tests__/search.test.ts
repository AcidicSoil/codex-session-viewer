import { describe, it, expect } from 'vitest'
import { matchesEvent, normalize } from '../search'
import type { ResponseItem } from '../../types'

describe('search utilities', () => {
  it('normalizes query', () => {
    expect(normalize('  FoO ')).toBe('foo')
  })

  it('matches text within events', () => {
    const ev: ResponseItem = { type: 'Message', role: 'user', content: 'Hello World' }
    expect(matchesEvent(ev, 'hello')).toBe(true)
    expect(matchesEvent(ev, 'WORLD')).toBe(true)
    expect(matchesEvent(ev, 'missing')).toBe(false)
  })

  it('matches file paths in FileChange events', () => {
    const ev: ResponseItem = { type: 'FileChange', path: 'src/utils/applyPatchHints.ts', diff: '' }
    expect(matchesEvent(ev, 'applypatchhints')).toBe(true)
    expect(matchesEvent(ev, 'UTILS')).toBe(true)
    expect(matchesEvent(ev, 'unknown')).toBe(false)
  })

  it('returns true for empty query', () => {
    const ev: ResponseItem = { type: 'Message', role: 'user', content: 'anything' }
    expect(matchesEvent(ev, '')).toBe(true)
    expect(matchesEvent(ev, '   ')).toBe(true)
  })
})

