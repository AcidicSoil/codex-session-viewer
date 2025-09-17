import { describe, expect, it } from 'vitest'
import { extractCwdTagsFromText, extractCwdTagsFromEvents } from '../session-tags'

describe('session cwd tag extraction', () => {
  it('collects unique cwd strings from session text', () => {
    const text = [
      JSON.stringify({ timestamp: '2024-01-01T00:00:00Z', id: 'sess-1', cwd: '/home/user/project/' }),
      JSON.stringify({ type: 'LocalShellCall', command: 'ls', cwd: '/home/user/project' }),
      JSON.stringify({ type: 'FunctionCall', name: 'shell', args: { cwd: '/home/user/other' } }),
      JSON.stringify({ type: 'Other', data: { nested: { cwd: '/tmp/workspace ' } } }),
    ].join('\n')

    const tags = extractCwdTagsFromText(text)
    expect(tags).toEqual(['/home/user/project', '/home/user/other', '/tmp/workspace'])
  })

  it('limits to the requested maximum number of tags', () => {
    const meta = JSON.stringify({ timestamp: '2024-01-01T00:00:00Z' })
    const events = Array.from({ length: 10 }, (_, i) => (
      JSON.stringify({ type: 'LocalShellCall', command: 'echo', cwd: `/repo/${i}` })
    ))
    const text = [meta, ...events].join('\n')

    const tags = extractCwdTagsFromText(text, 4)
    expect(tags).toHaveLength(4)
    expect(tags).toEqual(['/repo/0', '/repo/1', '/repo/2', '/repo/3'])
  })

  it('supports extracting from parsed events directly', () => {
    const meta = { timestamp: '2024-01-01T00:00:00Z', cwd: '/meta/path' }
    const events = [
      { type: 'LocalShellCall', command: 'ls', cwd: '/meta/path' },
      { type: 'CustomToolCall', toolName: 'demo', output: { cwd: '/tool/output' } },
    ] as any

    const tags = extractCwdTagsFromEvents(meta as any, events)
    expect(tags).toEqual(['/meta/path', '/tool/output'])
  })
})
