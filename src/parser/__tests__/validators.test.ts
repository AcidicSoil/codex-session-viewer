import { describe, it, expect } from 'vitest'
import { parseSessionMetaLine, parseResponseItemLine } from '../../parser/validators'

const metaOk = JSON.stringify({ id: 's1', timestamp: '2025-01-01T00:00:00Z', version: 1 })
const msgOk = JSON.stringify({ type: 'Message', role: 'user', content: 'hi' })
const msgArr = JSON.stringify({ type: 'Message', role: 'assistant', content: [{ type: 'text', text: 'hello' }] })

describe('validators', () => {
  it('parses valid meta', () => {
    const res = parseSessionMetaLine(metaOk)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.id).toBe('s1')
    }
  })

  it('fails invalid json', () => {
    const res = parseSessionMetaLine('{ not json')
    expect(res.success).toBe(false)
    if (!res.success) expect(res.reason).toBe('invalid_json')
  })

  it('parses valid event and rejects invalid schema', () => {
    const ok = parseResponseItemLine(msgOk)
    expect(ok.success).toBe(true)

    const bad = parseResponseItemLine(JSON.stringify({ type: 'Message', role: 'user' }))
    expect(bad.success).toBe(false)
    if (!bad.success) expect(bad.reason).toBe('invalid_schema')
  })

  it('parses message content arrays', () => {
    const res = parseResponseItemLine(msgArr)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(Array.isArray(res.data.content)).toBe(true)
      const arr = res.data.content as any
      expect(arr[0].text).toBe('hello')
    }
  })
})
