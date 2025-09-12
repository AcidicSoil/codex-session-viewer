import { describe, it, expect } from 'vitest'
import { parseUnifiedDiffToSides } from '../diff'
import { analyzeText, analyzeDiff } from '../guards'
import { getLanguageForPath } from '../language'

describe('diff utilities', () => {
  it('parses multi-hunk unified diff', () => {
    const diff = `diff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1,2 +1,2 @@\n-line1\n+line1-mod\n@@ -4,3 +4,4 @@\n line4\n-line5\n+line5-new\n line6\n`
    const { original, modified } = parseUnifiedDiffToSides(diff)
    expect(original).toContain('line1')
    expect(modified).toContain('line5-new')
  })

  it('parses headerless and hunkless diffs with +/-/space lines', () => {
    const diff = [
      ' line1',
      '-line2',
      '+line2-mod',
      ' line3',
      '',
    ].join('\n')
    const { original, modified } = parseUnifiedDiffToSides(diff)
    expect(original).toContain('line2')
    expect(modified).toContain('line2-mod')
    expect(original).toContain('line1')
    expect(modified).toContain('line1')
  })

  it('detects binary and large diffs', () => {
    expect(analyzeText('\u0000abc').binary).toBe(true)
    expect(analyzeDiff('a'.repeat(600000)).large).toBe(true)
  })

  it('gets language from path', () => {
    expect(getLanguageForPath('foo.tsx')).toBe('typescript')
    expect(getLanguageForPath('foo.unknown')).toBe('plaintext')
  })
})
