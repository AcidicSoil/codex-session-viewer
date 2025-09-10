import { describe, it, expect } from 'vitest'
import { containsApplyPatchAnywhere } from '../applyPatchHints'

describe('applyPatchHints', () => {
  it('detects nested apply_patch occurrences', () => {
    const ev = {
      args: {
        layers: [
          { message: 'no patch here' },
          { deeper: { text: 'something apply_patch inside' } },
        ],
      },
    }
    expect(containsApplyPatchAnywhere(ev)).toBe(true)
  })

  it('returns false when apply_patch is absent', () => {
    const ev = { args: { nested: [{ msg: 'hello' }] } }
    expect(containsApplyPatchAnywhere(ev)).toBe(false)
  })

  it('handles null or primitive inputs gracefully', () => {
    expect(containsApplyPatchAnywhere(null)).toBe(false)
    expect(containsApplyPatchAnywhere(undefined)).toBe(false)
  })
})

