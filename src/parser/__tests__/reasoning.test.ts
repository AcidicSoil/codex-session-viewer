import { describe, it, expect } from 'vitest'
import { parseResponseItemLine } from '../validators'

describe('reasoning content fallbacks', () => {
  it('uses summary when content is empty', () => {
    const line = JSON.stringify({ type: 'reasoning', content: '', summary: 'fallback summary' })
    const res = parseResponseItemLine(line)
    expect(res.success).toBe(true)
    if (res.success) {
      const ev = res.data as any
      expect(ev.type).toBe('Reasoning')
      expect(ev.content).toBe('fallback summary')
    }
  })

  it('surfaces [encrypted] when only encrypted_content exists', () => {
    const line = JSON.stringify({ type: 'reasoning', encrypted_content: 'deadbeef' })
    const res = parseResponseItemLine(line)
    expect(res.success).toBe(true)
    if (res.success) {
      const ev = res.data as any
      expect(ev.type).toBe('Reasoning')
      expect(ev.content).toBe('[encrypted]')
    }
  })
})
