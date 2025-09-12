/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest'
import { parseHash, stringifyHash, updateHash, type HashMap } from '../../utils/hashState'

describe('hashState utilities', () => {
  beforeEach(() => {
    // Reset hash before each test
    window.location.hash = ''
  })

  it('parseHash returns empty map for empty hash', () => {
    expect(parseHash()).toEqual({})
  })

  it('parseHash decodes keys and values', () => {
    window.location.hash = '#a=1&b=two%20words&c=%2Fpath%2Fhere'
    expect(parseHash()).toEqual({ a: '1', b: 'two words', c: '/path/here' })
  })

  it('stringifyHash encodes keys and values and omits empty entries', () => {
    const map: HashMap = { a: '1', empty: '', sp: 'two words' }
    const s = stringifyHash(map)
    expect(s.startsWith('#')).toBe(true)
    expect(s).toContain('a=1')
    expect(s).toContain('sp=two%20words')
    expect(s).not.toContain('empty')
  })

  it('updateHash applies updater and sets window.location.hash', () => {
    window.location.hash = '#x=1'
    updateHash(prev => ({ ...prev, y: '2' }))
    const h = parseHash()
    expect(h.x).toBe('1')
    expect(h.y).toBe('2')
  })
})
