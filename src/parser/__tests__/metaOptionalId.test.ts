import { describe, it, expect } from 'vitest'
import { parseSessionMetaLine, parseResponseItemLine, streamParseSession } from '../../parser'

describe('meta id optional', () => {
  it('parses meta without id', () => {
    const metaLine = JSON.stringify({ timestamp: '2025-01-01T00:00:00Z', version: 1 })
    const res = parseSessionMetaLine(metaLine)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.id).toBeUndefined()
      expect(res.data.timestamp).toBe('2025-01-01T00:00:00Z')
    }
  })

  it('streams a session where the meta has no id', async () => {
    const lines = [
      JSON.stringify({ timestamp: '2025-01-01T00:00:00Z' }),
      JSON.stringify({ type: 'Message', role: 'user', content: 'hi' }),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const items: any[] = []
    for await (const it of streamParseSession(blob)) items.push(it)
    const meta = items.find((x) => x.kind === 'meta')
    const ev = items.find((x) => x.kind === 'event')
    expect(meta).toBeTruthy()
    expect(meta.meta.id).toBeUndefined()
    expect(ev).toBeTruthy()
    expect(ev.event.type).toBe('Message')
  })
})

