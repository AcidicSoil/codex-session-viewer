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

  it('parses iso datetime with time', () => {
    const ts = parseTimestampFromPath('2024-06-10T12-30-00.txt')
    expect(ts).toBe(Date.UTC(2024, 5, 10, 12, 30, 0))
  })

  it('returns null when missing', () => {
    expect(parseTimestampFromPath('foo/bar')).toBeNull()
  })
})
