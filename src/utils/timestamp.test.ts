import { describe, it, expect } from 'vitest'
import { parseTimestampFromPath } from './timestamp'

describe('parseTimestampFromPath', () => {
  it('parses yyyy-mm-dd', () => {
    const ts = parseTimestampFromPath('logs/2024-06-10/output.txt')
    expect(ts).toBe(Date.UTC(2024, 5, 10))
  })

  it('parses yyyyMMdd', () => {
    const ts = parseTimestampFromPath('20240610.log')
    expect(ts).toBe(Date.UTC(2024, 5, 10))
  })

  it('parses epoch seconds', () => {
    const ts = parseTimestampFromPath('foo/1718025600.json')
    expect(ts).toBe(1718025600 * 1000)
  })

  it('returns null when missing', () => {
    expect(parseTimestampFromPath('foo/bar')).toBeNull()
  })
})
