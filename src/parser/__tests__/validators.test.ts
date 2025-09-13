import { describe, it, expect } from 'vitest'
import { parseSessionMetaLine, parseResponseItemLine } from '../../parser/validators'

const metaOk = JSON.stringify({ id: 's1', timestamp: '2025-01-01T00:00:00Z', version: 1 })
const msgOk = JSON.stringify({ type: 'Message', role: 'user', content: 'hi' })

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

  it('converts shell function call to LocalShellCall and parses output', () => {
    const line = JSON.stringify({
      type: 'FunctionCall',
      name: 'shell',
      args: JSON.stringify({ command: 'echo 1', cwd: '/tmp' }),
      result: JSON.stringify({ stdout: '1', stderr: '', exitCode: 0, durationMs: 5 }),
    })
    const res = parseResponseItemLine(line)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.type).toBe('LocalShellCall')
      expect(res.data.command).toBe('echo 1')
      expect(res.data.cwd).toBe('/tmp')
      expect(res.data.stdout).toBe('1')
      expect(res.data.stderr).toBe('')
      expect(res.data.exitCode).toBe(0)
      expect(res.data.durationMs).toBe(5)
    }
  })
})
