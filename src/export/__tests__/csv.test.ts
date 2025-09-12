import { describe, it, expect } from 'vitest'
import { toCSV, defaultCsvFields } from '../csv'
import type { ResponseItem } from '../../types'

describe('toCSV', () => {
  it('emits header and quoted rows', () => {
    const rows: ResponseItem[] = [
      { type: 'Message', role: 'user', content: 'hello, world', at: '2025-09-11T00:00:00Z', index: 0 },
      { type: 'FileChange', path: 'src/app.tsx', diff: '--- a\n+++ b\n+line', at: '2025-09-11T00:00:01Z', index: 1 },
    ] as any
    const csv = toCSV(rows, defaultCsvFields)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('index,at,type,role,model,path,command,name,content,diff')
    // content with comma should be quoted on the first data row
    expect(lines[1]).toContain('"hello, world"')
    // diff body should be quoted (may span multiple newlines)
    expect(csv).toContain('"--- a')
  })
})
