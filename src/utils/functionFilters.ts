export function isApplyPatchFunction(ev: any): boolean {
  if (!ev || ev.type !== 'FunctionCall') return false
  if (ev.name !== 'shell') return false
  try {
    const a = ev.args
    const parsed = typeof a === 'string' ? JSON.parse(a) : a
    return parsed && Array.isArray(parsed.command) && parsed.command[0] === 'apply_patch'
  } catch {
    return false
  }
}

/**
 * Return true if the event passes the selected function-name filters.
 * - Empty selection ⇒ pass-through (no filtering).
 * - Selection may include concrete names (e.g., 'shell') and the special 'apply_patch'.
 * - Only applies to FunctionCall events. When `typeFilter` is 'ToolCalls' and a name filter exists,
 *   non-FunctionCall tool events are excluded.
 */
export function passesFunctionNameFilter(
  ev: any,
  selected: readonly string[],
  typeFilter: string,
): boolean {
  if (!selected || selected.length === 0) return true

  if (ev?.type !== 'FunctionCall') {
    // If the user selected ToolCalls and applied function filters, only FunctionCall events remain
    return typeFilter === 'ToolCalls' ? false : true
  }

  if (selected.includes('apply_patch') && isApplyPatchFunction(ev)) return true
  if (ev?.name && selected.includes(String(ev.name))) return true
  return false
}

/** Sanitize a list of function-name tokens coming from URL/state. */
export function sanitizeFnFilterList(list: unknown): string[] {
  const arr: unknown[] = Array.isArray(list) ? (list as unknown[]) : (typeof list === 'string' ? (list as string).split(',') : [])
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of arr) {
    const s = String(raw ?? '').trim()
    if (!s) continue
    if (s.length > 64) continue // avoid pathological tokens
    if (/[\u0000-\u001f]/.test(s)) continue // control chars
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
    if (out.length >= 20) break // cap selection size
  }
  return out
}
