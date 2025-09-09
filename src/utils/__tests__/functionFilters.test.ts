import { describe, it, expect } from 'vitest'
import { isApplyPatchFunction, passesFunctionNameFilter } from '../functionFilters'

const shellApplyPatch = {
  type: 'FunctionCall',
  name: 'shell',
  args: JSON.stringify({ command: ['apply_patch', '*** Begin Patch\n*** End Patch\n'] }),
}

const shellOther = {
  type: 'FunctionCall',
  name: 'shell',
  args: JSON.stringify({ command: ['echo', 'hi'] }),
}

const webRun = {
  type: 'FunctionCall',
  name: 'web.run',
  args: { query: 'hello' },
}

describe('functionFilters', () => {
  it('detects apply_patch shell calls', () => {
    expect(isApplyPatchFunction(shellApplyPatch)).toBe(true)
    expect(isApplyPatchFunction(shellOther)).toBe(false)
    expect(isApplyPatchFunction(webRun)).toBe(false)
  })

  it('passes name filter for exact names and apply_patch special', () => {
    expect(passesFunctionNameFilter(shellApplyPatch, [], 'FunctionCall')).toBe(true)
    expect(passesFunctionNameFilter(shellApplyPatch, ['apply_patch'], 'FunctionCall')).toBe(true)
    expect(passesFunctionNameFilter(shellOther, ['apply_patch'], 'FunctionCall')).toBe(false)
    expect(passesFunctionNameFilter(webRun, ['web.run'], 'FunctionCall')).toBe(true)
  })
})

