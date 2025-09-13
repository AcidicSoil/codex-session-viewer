import { describe, it, expect } from 'vitest'
import { parseResponseItemLine, parseSessionMetaLine } from '../validators'
import { streamParseSession } from '../streaming'

function blobOf(lines: string[]) { return new Blob([lines.join('\n')], { type: 'text/plain' }) }

describe('foreign wrappers and blanks', () => {
  it('unwraps meta wrapper', () => {
    const metaWrapped = JSON.stringify({ record_type: 'meta', record: { timestamp: '2025-01-01T00:00:00Z', id: 'x' } })
    const m = parseSessionMetaLine(metaWrapped)
    expect(m.success).toBe(true)
    if (m.success) expect(m.data.timestamp).toContain('2025-01-01')
  })

  it('unwraps event wrapper', () => {
    const wrapped = JSON.stringify({ record_type: 'event', record: { type: 'message', role: 'user', content: 'hi' } })
    const r = parseResponseItemLine(wrapped)
    expect(r.success).toBe(true)
    if (r.success) expect((r.data as any).type).toBe('Message')
  })

  it('maps dotted types like message.created and tool_call.completed', () => {
    const msg = JSON.stringify({ type: 'message.created', role: 'assistant', content: [{ type: 'text', text: 'hello' }] })
    const tool = JSON.stringify({ type: 'tool_call.completed', name: 'apply_patch', result: { ok: true } })
    const r1 = parseResponseItemLine(msg)
    const r2 = parseResponseItemLine(tool)
    expect(r1.success && (r1 as any).data.type === 'Message').toBe(true)
    expect(r2.success && (r2 as any).data.type === 'FunctionCall').toBe(true)
  })

  it('tolerates array-style NDJSON (brackets and trailing comma)', async () => {
    const meta = JSON.stringify({ timestamp: '2025-02-02T00:00:00Z' })
    const e1 = JSON.stringify({ type: 'Message', role: 'user', content: 'hello' }) + ','
    const blob = blobOf(['[', meta, e1, ']'])
    let done = false
    let events = 0
    for await (const it of streamParseSession(blob)) {
      if (it.kind === 'event') events++
      if (it.kind === 'done') {
        expect(it.stats.parsedEvents).toBe(1)
        done = true
      }
    }
    expect(done).toBe(true)
    expect(events).toBe(1)
  })

  it('skips blank lines without counting as errors', async () => {
    const meta = JSON.stringify({ timestamp: '2025-01-01T00:00:00Z' })
    const ev = JSON.stringify({ type: 'Message', role: 'user', content: 'ok' })
    const blob = blobOf([meta, '', '   ', ev])
    let done = false
    for await (const it of streamParseSession(blob)) {
      if (it.kind === 'done') {
        expect(it.stats.totalLines).toBe(4)
        expect(it.stats.parsedEvents).toBe(1)
        expect(it.stats.failedLines).toBe(0)
        done = true
      }
    }
    expect(done).toBe(true)
  })

  it('unwraps { type: "response_item", payload: {...} } with message content', () => {
    const wrapped = JSON.stringify({
      timestamp: '2025-09-11T19:50:48.743Z',
      type: 'response_item',
      payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hello world' }] },
    })
    const r = parseResponseItemLine(wrapped)
    expect(r.success).toBe(true)
    if (r.success) {
      expect((r.data as any).type).toBe('Message')
      expect((r.data as any).role).toBe('user')
      expect((r.data as any).content).toEqual([
        { type: 'text', text: 'hello world' },
      ])
    }
  })

  it('unwraps { type: "event_msg", payload: { type: "agent_reasoning" } } to Reasoning', () => {
    const wrapped = JSON.stringify({
      timestamp: '2025-09-11T19:56:22.140Z',
      type: 'event_msg',
      payload: { type: 'agent_reasoning', text: '**Thinking**\nI will do X then Y.' },
    })
    const r = parseResponseItemLine(wrapped)
    expect(r.success).toBe(true)
    if (r.success) {
      expect((r.data as any).type).toBe('Reasoning')
      expect((r.data as any).content).toContain('I will do X')
    }
  })
})
