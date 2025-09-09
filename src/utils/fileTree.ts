export type FileTreeNode = {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileTreeNode[]
}

export function normalizePath(p: string): string {
  let s = p.split('\\').join('/');
  while (s.startsWith('./')) s = s.slice(2);
  while (s.startsWith('/')) s = s.slice(1);
  s = s.replace(/\/{2,}/g, '/');
  return s;
}

/**
 * Convert a list of POSIX-style file paths into a nested tree.
 * Paths may be absolute or relative; leading './' or '/' are ignored in splitting.
 */
export function buildFileTree(paths: readonly string[]): FileTreeNode[] {
  const norm = normalizePath
  const root: Map<string, any> = new Map()

  for (const raw of paths) {
    if (!raw) continue
    const p = norm(raw)
    const parts = p.split('/').filter(Boolean) as string[]
    if (parts.length === 0) continue
    let cur = root
    let acc = ''
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i]!
      acc = acc ? `${acc}/${seg}` : seg
      const isLeaf = i === parts.length - 1
      if (!cur.has(seg)) {
        cur.set(seg, {
          name: seg,
          path: acc,
          type: isLeaf ? 'file' : 'dir',
          children: isLeaf ? undefined : new Map<string, any>(),
        })
      }
      const node = cur.get(seg) as any
      if (!isLeaf) {
        if (!node.children) node.children = new Map<string, any>()
        cur = node.children as Map<string, any>
      }
    }
  }

  function toArray(map: Map<string, any>): FileTreeNode[] {
    const items: FileTreeNode[] = []
    for (const [, v] of map) {
      if (v.type === 'dir') {
        const children = toArray(v.children)
        items.push({ name: v.name, path: v.path, type: 'dir', children })
      } else {
        items.push({ name: v.name, path: v.path, type: 'file' })
      }
    }
    // sort: dirs first, then files; both alpha by name
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return items
  }

  return toArray(root)
}

/** Expand ancestor dir paths for a given file path (split prefixes). */
export function ancestorDirs(path: string): string[] {
  const parts = normalizePath(path).split('/').filter(Boolean) as string[]
  const acc: string[] = []
  let cur = ''
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i]!
    cur = cur ? `${cur}/${seg}` : seg
    acc.push(cur)
  }
  return acc
}
