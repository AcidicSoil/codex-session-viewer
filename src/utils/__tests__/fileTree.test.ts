import { describe, it, expect } from 'vitest'
import { buildFileTree, ancestorDirs, normalizePath } from '../fileTree'

describe('file tree utilities', () => {
  it('builds a nested tree structure', () => {
    const tree = buildFileTree(['src/a.ts', 'src/b/c.ts', 'README.md'])
    expect(tree).toHaveLength(2)
    const src = tree.find((n) => n.name === 'src')!
    expect(src.type).toBe('dir')
    expect(src.children?.map((c) => c.name).sort()).toEqual(['a.ts', 'b'])
    const b = src.children?.find((c) => c.name === 'b')!
    expect(b.type).toBe('dir')
    expect(b.children?.[0]?.name).toBe('c.ts')
    const readme = tree.find((n) => n.name === 'README.md')!
    expect(readme.type).toBe('file')
  })

  it('computes ancestor directories', () => {
    expect(ancestorDirs('src/b/c.ts')).toEqual(['src', 'src/b'])
  })

  it('normalizes paths', () => {
    expect(normalizePath('\\foo\\bar')).toBe('foo/bar')
    expect(normalizePath('./src//a.ts')).toBe('src/a.ts')
  })
})
