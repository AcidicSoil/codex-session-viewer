import { z, ZodError } from 'zod'
import { SessionMetaSchema, ResponseItemSchema, type SessionMetaParsed, type ResponseItemParsed } from './schemas'

export type ParseFailureReason = 'invalid_json' | 'invalid_schema'

export type SafeResult<T> =
  | { success: true; data: T }
  | { success: false; error: ZodError | SyntaxError; reason: ParseFailureReason }

function tryParseJson(line: string): { success: true; data: unknown } | { success: false; error: SyntaxError } {
  try {
    return { success: true, data: JSON.parse(line) }
  } catch (e) {
    return { success: false, error: e as SyntaxError }
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export function parseSessionMetaLine(line: string): SafeResult<SessionMetaParsed> {
  const j = tryParseJson(line)
  if (!j.success) return { success: false, error: j.error, reason: 'invalid_json' }
  const res = SessionMetaSchema.safeParse(j.data)
  if (!res.success) return { success: false, error: res.error, reason: 'invalid_schema' }
  return { success: true, data: res.data }
}

export function parseResponseItemLine(line: string): SafeResult<ResponseItemParsed> {
  const j = tryParseJson(line)
  if (!j.success) return { success: false, error: j.error, reason: 'invalid_json' }

  // Try normalization of foreign event shapes (lowercase types, nested payloads, snake_case)
  if (isRecord(j.data)) {
    const normalized = normalizeForeignEventShape(j.data)
    if (normalized) {
      const normRes = ResponseItemSchema.safeParse(normalized)
      if (normRes.success) return { success: true, data: normRes.data }
    }
  }

  // Fallback: strict schema as-is
  const res = ResponseItemSchema.safeParse(j.data)
  if (res.success) return { success: true, data: res.data }

  // Fallback: if discriminator is unknown/missing, coerce to Other-event to avoid hard failure
  // Preserve base fields when available, and tuck the original payload under `data`.
  if (isRecord(j.data)) {
    const base = j.data
    const t = typeof base.type === 'string' ? base.type : undefined
    const known = [
      'Message',
      'Reasoning',
      'FunctionCall',
      'LocalShellCall',
      'WebSearchCall',
      'CustomToolCall',
      'FileChange',
      'Other',
    ]
    if (!t || !known.includes(t)) {
      const fallback = {
        type: 'Other',
        id: typeof base.id === 'string' ? base.id : undefined,
        at: typeof base.at === 'string' ? base.at : undefined,
        index: typeof base.index === 'number' ? base.index : undefined,
        data: base,
      }
      const alt = ResponseItemSchema.safeParse(fallback)
      if (alt.success) return { success: true, data: alt.data }
    }
  }

  return { success: false, error: res.error, reason: 'invalid_schema' }
}

// --- helpers ---------------------------------------------------------------

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (v == null) return undefined
  try { return JSON.stringify(v) } catch { return String(v) }
}

function toCamel<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    const ck = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    out[ck] = v
  }
  return out as T
}

function flattenContent(content: unknown): string | undefined {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const parts: string[] = []
    for (const b of content) {
      if (b && typeof b === 'object' && 'text' in (b as any)) parts.push(String((b as any).text))
      else parts.push(asString(b) ?? '')
    }
    return parts.join('\n')
  }
  return asString(content)
}

function tryParseJsonText(s?: string): unknown {
  if (!s) return undefined
  try { return JSON.parse(s) } catch { return s }
}

function normalizeForeignEventShape(data: Record<string, unknown>): Record<string, unknown> | null {
  // tolerate snake_case base fields
  const base = toCamel(data)
  const t = typeof base.type === 'string' ? String(base.type).toLowerCase() : undefined

  // Some lines are state markers; keep as Other to avoid noise in timeline logic
  if (!t && typeof (base as any).record_type === 'string') {
    return { type: 'Other', id: asString(base.id), at: asString(base.at), index: (base as any).index, data: data }
  }

  switch (t) {
    case 'message': {
      const content = flattenContent((base as any).content)
      if (content === undefined) return null
      const role = typeof base.role === 'string' ? base.role : 'assistant'
      const model = typeof (base as any).model === 'string' ? (base as any).model : undefined
      return { type: 'Message', role, content, model, id: base.id, at: base.at, index: base.index }
    }
    case 'reasoning': {
      const content = flattenContent((base as any).content)
      if (content === undefined) return null
      return { type: 'Reasoning', content, id: base.id, at: base.at, index: base.index }
    }
    case 'function_call': {
      const name = asString((base as any).name) ?? asString((base as any).toolName) ?? 'function'
      const args = (base as any).args ?? (base as any).arguments
      const durationMs = typeof (base as any).durationMs === 'number' ? (base as any).durationMs
        : typeof (base as any).duration_ms === 'number' ? (base as any).duration_ms : undefined
      return { type: 'FunctionCall', name, args, durationMs, id: base.id, at: base.at, index: base.index }
    }
    case 'function_call_output': {
      const name = asString((base as any).name) ?? asString((base as any).toolName) ?? asString((base as any).call_id) ?? 'function'
      const raw = asString((base as any).output)
      const parsed = tryParseJsonText(raw)
      // If parsed is array of {text}, join into string for readability
      let result: unknown = parsed
      if (Array.isArray(parsed) && parsed.every((x) => x && typeof x === 'object' && 'text' in (x as any))) {
        result = (parsed as any[]).map((x) => (x as any).text).join('\n')
      }
      return { type: 'FunctionCall', name, result, id: base.id, at: base.at, index: base.index }
    }
    case 'local_shell_call': {
      const exitCode = typeof (base as any).exitCode === 'number' ? (base as any).exitCode
        : typeof (base as any).exit_code === 'number' ? (base as any).exit_code : undefined
      const durationMs = typeof (base as any).durationMs === 'number' ? (base as any).durationMs
        : typeof (base as any).duration_ms === 'number' ? (base as any).duration_ms : undefined
      return {
        type: 'LocalShellCall',
        command: String((base as any).command ?? ''),
        cwd: asString((base as any).cwd),
        exitCode,
        stdout: asString((base as any).stdout),
        stderr: asString((base as any).stderr),
        durationMs,
        id: base.id, at: base.at, index: base.index,
      }
    }
    case 'web_search_call': {
      const results = Array.isArray((base as any).results) ? (base as any).results as any[] : undefined
      return {
        type: 'WebSearchCall',
        query: String((base as any).query ?? ''),
        provider: asString((base as any).provider),
        results: results?.map((r) => ({ title: asString((r as any).title), url: asString((r as any).url), snippet: asString((r as any).snippet) })),
        id: base.id, at: base.at, index: base.index,
      }
    }
    case 'custom_tool_call': {
      return {
        type: 'CustomToolCall',
        toolName: asString((base as any).toolName) ?? asString((base as any).name) ?? 'tool',
        input: (base as any).input,
        output: (base as any).output,
        id: base.id, at: base.at, index: base.index,
      }
    }
    case 'file_change': {
      return {
        type: 'FileChange',
        path: asString((base as any).path) ?? '',
        diff: asString((base as any).diff ?? (base as any).patch),
        id: base.id, at: base.at, index: base.index,
      }
    }
  }

  // Unrecognized -> let fallback handle as Other
  return null
}
