import { describe, it, expect } from 'vitest'
import { streamParseSession, parseSessionToArrays } from '../../parser/streaming'

function makeBlob(lines: string[]) {
  return new Blob([lines.join('\n')], { type: 'text/plain' })
}

const meta = JSON.stringify({ id: 's1', timestamp: '2025-01-01T00:00:00Z', version: 1 })
const evt1 = JSON.stringify({ type: 'Message', role: 'user', content: 'hi' })
const evt2 = JSON.stringify({ type: 'LocalShellCall', command: 'echo 1', stdout: '1' })

describe('streaming parser', () => {
  it('yields meta, events, errors, and done', async () => {
    const blob = makeBlob([meta, evt1, '{ not json', evt2])
    const kinds: string[] = []
    let ok = 0, fail = 0

    for await (const item of streamParseSession(blob, { maxErrors: 10 })) {
      kinds.push(item.kind)
      if (item.kind === 'event') ok++
      if (item.kind === 'error') fail++
      if (item.kind === 'done') {
        expect(item.stats.totalLines).toBe(4)
        expect(item.stats.parsedEvents).toBe(2)
        expect(item.stats.failedLines).toBe(1)
      }
    }

    expect(kinds[0]).toBe('meta')
    expect(ok).toBe(2)
    expect(fail).toBe(1)
  })

  it('collects arrays via parseSessionToArrays', async () => {
    const blob = makeBlob([meta, evt1, evt2])
    const res = await parseSessionToArrays(blob)
    expect(res.meta?.id).toBe('s1')
    expect(res.events.length).toBe(2)
    expect(res.errors.length).toBe(0)
    expect(res.stats?.totalLines).toBe(3)
  })
})
