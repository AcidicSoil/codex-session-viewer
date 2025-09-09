export function containsApplyPatchAnywhere(ev: any): boolean {
  try {
    if (!ev) return false
    const substr = 'apply_patch'
    const scan = (v: unknown): boolean => {
      if (v == null) return false
      const t = typeof v
      if (t === 'string') return (v as string).includes(substr)
      if (t === 'number' || t === 'boolean') return false
      if (Array.isArray(v)) {
        for (const x of v) if (scan(x)) return true
        return false
      }
      if (t === 'object') {
        for (const k in v as any) if (scan((v as any)[k])) return true
        return false
      }
      return false
    }
    // Scan relevant fields first for performance
    if (scan((ev as any).args)) return true
    if (scan((ev as any).result)) return true
    if (scan((ev as any).content)) return true
    if (scan((ev as any).diff)) return true
    // Fallback: scan the whole object shallowly
    return false
  } catch {
    return false
  }
}
