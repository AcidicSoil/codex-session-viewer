import { describe, it, expect } from 'vitest'
import { parseSessionMetaLine, parseResponseItemLine } from '../../parser/validators'

const metaOk = JSON.stringify({ id: 's1', timestamp: '2025-01-01T00:00:00Z', version: 1 })
const msgOk = JSON.stringify({ type: 'Message', role: 'user', content: 'hi' })
const msgArrOk = JSON.stringify({
  type: 'Message',
  role: 'user',
  content: [
    { type: 'text', text: 'hello' },
    { type: 'text', text: 'world' },
  ],
})

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

  it('parses message content as string or array', () => {
    const strRes = parseResponseItemLine(msgOk)
    expect(strRes.success).toBe(true)
    if (strRes.success) {
      expect(strRes.data.type).toBe('Message')
      expect(strRes.data.content).toBe('hi')
    }

    const arrRes = parseResponseItemLine(msgArrOk)
    expect(arrRes.success).toBe(true)
    if (arrRes.success) {
      expect(arrRes.data.type).toBe('Message')
      expect(arrRes.data.content).toEqual([
        { type: 'text', text: 'hello' },
        { type: 'text', text: 'world' },
      ])
    }
  })

  // Generic function calls remain FunctionCall events
  it('parses function_call events with arguments field', () => {
    const line = JSON.stringify({ type: 'function_call', name: 'sum', arguments: { a: 1, b: 2 } })
    const res = parseResponseItemLine(line)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.type).toBe('FunctionCall')
      expect(res.data.args).toEqual({ a: 1, b: 2 })
    }
  })

  // A function_call named "shell" is transformed into a LocalShellCall
  it('converts shell function_call to LocalShellCall', () => {
    const line = JSON.stringify({ type: 'function_call', name: 'shell', arguments: '{"command":"echo hi","cwd":"/tmp"}' })
    const res = parseResponseItemLine(line)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.type).toBe('LocalShellCall')
      expect(res.data.command).toBe('echo hi')
      expect(res.data.cwd).toBe('/tmp')
    }
  })

  // Corresponding output events are also mapped to LocalShellCall with stdout/stderr
  it('parses shell function_call_output with stdout/stderr', () => {
    const line = JSON.stringify({ type: 'function_call_output', name: 'shell', output: '{"stdout":"ok","stderr":"err","exit_code":1}' })
    const res = parseResponseItemLine(line)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.type).toBe('LocalShellCall')
      expect(res.data.stdout).toBe('ok')
      expect(res.data.stderr).toBe('err')
      expect(res.data.exitCode).toBe(1)
    }
  })
})
