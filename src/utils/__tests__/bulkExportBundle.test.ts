import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'

import {
  buildBulkExportBundle,
  DEFAULT_COLUMN_KEYS,
  type BulkSessionRecord,
} from '../exporters'
import type { ResponseItem } from '../../types'

const baseSession = (overrides: Partial<BulkSessionRecord>): BulkSessionRecord => ({
  path: 'session.jsonl',
  meta: { id: 'session-id', timestamp: '2024-01-01T00:00:00Z' } as any,
  events: [
    {
      type: 'Message',
      role: 'assistant',
      content: 'hello world',
    } as ResponseItem,
  ],
  ...overrides,
})

describe('buildBulkExportBundle', () => {
  it('creates a JSON payload with metadata for each session', async () => {
    const sessions: BulkSessionRecord[] = [
      baseSession({ path: 'foo/first.jsonl' }),
    ]

    const bundle = await buildBulkExportBundle(sessions, 'json', DEFAULT_COLUMN_KEYS, {
      timestamp: new Date('2024-02-02T00:00:00Z'),
    })

    if (bundle.kind !== 'json') throw new Error('Expected JSON bundle')
    expect(bundle.filename).toBe('codex-sessions-export-2024-02-02T00-00-00-000Z.json')

    const payload = JSON.parse(bundle.text) as any
    expect(payload.total).toBe(1)
    expect(payload.source).toBe('.codex/sessions')
    expect(payload.sessions[0]?.path).toBe('foo/first.jsonl')
    expect(payload.sessions[0]?.filename).toMatch(/\.json$/)
  })

  it('bundles markdown exports into a zip archive with unique filenames', async () => {
    const sessions: BulkSessionRecord[] = [
      baseSession({ path: 'dup/a.jsonl', meta: { id: 'dup', timestamp: '2024-01-01T00:00:00Z' } as any }),
      baseSession({ path: 'dup/b.jsonl', meta: { id: 'dup', timestamp: '2024-01-02T00:00:00Z' } as any }),
    ]

    const bundle = await buildBulkExportBundle(sessions, 'markdown', DEFAULT_COLUMN_KEYS, {
      timestamp: new Date('2024-03-03T00:00:00Z'),
    })

    if (bundle.kind !== 'zip') throw new Error('Expected zip bundle')
    expect(bundle.filename).toBe('codex-sessions-export-2024-03-03T00-00-00-000Z-markdown.zip')

    const archive = await JSZip.loadAsync(bundle.archive)
    const fileNames = Object.values(archive.files)
      .filter((entry) => !entry.dir)
      .map((entry) => entry.name)

    expect(fileNames.length).toBe(2)
    expect(new Set(fileNames).size).toBe(2)

    const sample = await archive.file(fileNames[0]!)!.async('string')
    expect(sample).toContain('# Session Export')
  })

  it('uses default CSV columns when exporting csv archives', async () => {
    const sessions: BulkSessionRecord[] = [
      baseSession({ path: 'csv/session.jsonl' }),
    ]

    const bundle = await buildBulkExportBundle(sessions, 'csv', DEFAULT_COLUMN_KEYS, {
      timestamp: new Date('2024-04-04T00:00:00Z'),
    })

    if (bundle.kind !== 'zip') throw new Error('Expected zip bundle')
    const archive = await JSZip.loadAsync(bundle.archive)
    const files = Object.values(archive.files).filter((entry) => !entry.dir)
    expect(files.length).toBe(1)

    const csv = await files[0]!.async('string')
    const header = csv.split('\n', 1)[0]
    expect(header).toBe(DEFAULT_COLUMN_KEYS.join(','))
  })
})

