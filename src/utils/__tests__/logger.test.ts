/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logError, logInfo } from '../logger'

describe('logger', () => {
  beforeEach(() => {
    // stub fetch to avoid network
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })) as any)
    ;(window as any).__csvErrors = []
  })

  it('logError records into window.__csvErrors and posts', async () => {
    logError('ctx', new Error('boom'), { a: 1 })
    const buf = (window as any).__csvErrors
    expect(Array.isArray(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(0)
    expect(buf[0].context ?? 'ctx').toBe('ctx')
    // fetch called
    expect((globalThis.fetch as any).mock.calls.length).toBe(1)
  })

  it('logInfo posts payload', () => {
    logInfo('ctx', 'hello')
    expect((globalThis.fetch as any).mock.calls.length).toBeGreaterThan(0)
  })
})
