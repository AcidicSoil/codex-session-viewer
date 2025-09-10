import { describe, it, expect } from 'vitest'
import { isGenericFileEditFunction, isApplyPatchFunction } from '../../utils/functionFilters'

describe('isGenericFileEditFunction', () => {
  it('returns false for non-FunctionCall', () => {
    expect(isGenericFileEditFunction({ type: 'Message' })).toBe(false)
  })

  it('excludes apply_patch', () => {
    const ev = { type: 'FunctionCall', name: 'shell', args: JSON.stringify({ command: ['apply_patch', '...'] }) }
    expect(isApplyPatchFunction(ev)).toBe(true)
    expect(isGenericFileEditFunction(ev)).toBe(false)
  })

  it('detects by function name hints', () => {
    const ev = { type: 'FunctionCall', name: 'desktop-commander__edit_block', args: '{}' }
    expect(isGenericFileEditFunction(ev)).toBe(true)
  })

  it('detects by args keys (path + content)', () => {
    const ev = { type: 'FunctionCall', name: 'custom_tool', args: JSON.stringify({ path: 'src/a.ts', content: 'hello' }) }
    expect(isGenericFileEditFunction(ev)).toBe(true)
  })

  it('detects by arrays of files', () => {
    const ev = { type: 'FunctionCall', name: 'custom_tool', args: JSON.stringify({ files: [{ path: 'a', content: 'b' }] }) }
    expect(isGenericFileEditFunction(ev)).toBe(true)
  })

  it('falls back to false when no hints present', () => {
    const ev = { type: 'FunctionCall', name: 'noop', args: JSON.stringify({ query: 'x' }) }
    expect(isGenericFileEditFunction(ev)).toBe(false)
  })
})

