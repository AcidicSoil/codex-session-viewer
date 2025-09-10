import type { FileHashRecord } from '../utils/session-db'

export type ChangeType = 'added' | 'modified' | 'deleted'

export interface ChangeItem {
  path: string
  type: ChangeType
  before?: FileHashRecord | null
  after?: FileHashRecord | null
}

export interface ChangeSet {
  added: number
  modified: number
  deleted: number
  items: ChangeItem[]
}

export function buildChangeSet(before: FileHashRecord[], after: FileHashRecord[]): ChangeSet {
  const beforeMap = new Map(before.map((r) => [r.path, r]))
  const afterMap = new Map(after.map((r) => [r.path, r]))

  const items: ChangeItem[] = []
  let added = 0, modified = 0, deleted = 0

  for (const [path, a] of afterMap) {
    const b = beforeMap.get(path)
    if (!b) {
      added++
      items.push({ path, type: 'added', before: null, after: a })
    } else if (a.hash !== b.hash) {
      modified++
      items.push({ path, type: 'modified', before: b, after: a })
    }
  }

  for (const [path, b] of beforeMap) {
    if (!afterMap.has(path)) {
      deleted++
      items.push({ path, type: 'deleted', before: b, after: null })
    }
  }

  items.sort((x, y) => x.path.localeCompare(y.path))
  return { added, modified, deleted, items }
}

