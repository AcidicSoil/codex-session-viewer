import ignore from 'ignore'
import { describe, expect, it } from 'vitest'
import {
  buildIgnoreFromHandle,
  createCompositeMatcher,
  globMatch,
  normalizeToPosix,
  type IgnoreLayer,
} from '../ignore-utils'

class FakeFileHandle {
  constructor(private readonly content: string) {}
  async getFile(): Promise<File> {
    const value = this.content
    return {
      async text() {
        return value
      },
    } as unknown as File
  }
}

class FakeDirectoryHandle {
  constructor(private readonly files: Record<string, string>) {}
  async getFileHandle(name: string): Promise<FakeFileHandle> {
    const entry = this.files[name]
    if (entry == null) {
      const err = new Error('NotFoundError')
      ;(err as any).name = 'NotFoundError'
      throw err
    }
    return new FakeFileHandle(entry)
  }
}

describe('ignore-utils', () => {
  it('reads ignore file contents when present', async () => {
    const dir = new FakeDirectoryHandle({ '.gitignore': 'node_modules/\n.DS_Store' })
    const lines = await buildIgnoreFromHandle(dir as unknown as FileSystemDirectoryHandle, '.gitignore')
    expect(lines).toEqual(['node_modules/', '.DS_Store'])
  })

  it('returns empty list when ignore file is missing', async () => {
    const dir = new FakeDirectoryHandle({})
    const lines = await buildIgnoreFromHandle(dir as unknown as FileSystemDirectoryHandle, '.codexignore')
    expect(lines).toEqual([])
  })

  it('normalizes windows-style paths to posix', () => {
    expect(normalizeToPosix('src\\app\\index.ts')).toBe('src/app/index.ts')
    expect(normalizeToPosix('./.gitignore')).toBe('.gitignore')
  })

  it('codexignore negations can override gitignore ignores', () => {
    const codexLayers: IgnoreLayer[] = [{ base: '', matcher: ignore().add(['!dist/keep.js']) }]
    const gitLayers: IgnoreLayer[] = [{ base: '', matcher: ignore().add(['dist/']) }]
    const codexMatcher = createCompositeMatcher(codexLayers)
    const gitMatcher = createCompositeMatcher(gitLayers)

    const path = 'dist/keep.js'
    const codexDecision = codexMatcher(path, false)
    const gitDecision = gitMatcher(path, false)

    expect(codexDecision.unignored).toBe(true)
    let ignored = false
    let allow = false
    if (codexDecision.ignored) ignored = true
    if (codexDecision.unignored) allow = true
    if (!ignored) {
      if (gitDecision.ignored && !allow) ignored = true
      if (gitDecision.unignored) allow = true
    }

    expect(ignored).toBe(false)
    expect(codexMatcher('dist/other.js', false).ignored).toBe(false)
  })

  it('nested ignore layers only apply to descendants of their base', () => {
    const rootLayer: IgnoreLayer[] = [{ base: '', matcher: ignore().add(['dist/']) }]
    const nestedLayer: IgnoreLayer[] = [{ base: 'packages/pkg', matcher: ignore().add(['build/']) }]
    const matcher = createCompositeMatcher([...rootLayer, ...nestedLayer])

    expect(matcher('dist/output.js', false).ignored).toBe(true)
    expect(matcher('packages/pkg/build/index.js', false).ignored).toBe(true)
    expect(matcher('packages/other/build/index.js', false).ignored).toBe(false)
  })

  it('matches glob patterns with micromatch semantics', () => {
    expect(globMatch('src/utils/fs.ts', ['src/**/*.ts'])).toBe(true)
    expect(globMatch('README.md', ['src/**/*.ts'])).toBe(false)
    expect(globMatch('src/feature/index.ts', ['src/**/index.ts'])).toBe(true)
  })
})
