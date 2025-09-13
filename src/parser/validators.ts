import { z, ZodError } from 'zod'
import { SessionMetaSchema, ResponseItemSchema, type SessionMetaParsed, type ResponseItemParsed } from './schemas'

export type ParseFailureReason = 'invalid_json' | 'invalid_schema'

export type SafeResult<T> =
  | { success: true; data: T }
  | { success: false; error: ZodError | SyntaxError; reason: ParseFailureReason }

function tryParseJson(line: string): { success: true; data: unknown } | { success: false; error: SyntaxError } {
  let s = line
  // Strip BOM and common anti-JSON prefixes (e.g., )]}')
  s = s.replace(/^\uFEFF/, '')
  s = s.replace(/^\)\]\}'?,?\s*/, '')
  // Ignore lone JSON array markers or dangling commas from array NDJSON
  const t = s.trim()
  if (t === '[' || t === ']' || t === '],') {
    // Represent as a special lightweight token object; caller will coerce to skip/Other
    return { success: true, data: { __csv_token__: t } }
  }
  try {
    return { success: true, data: JSON.parse(s) }
  } catch (e) {
    // Retry by trimming a trailing comma (array NDJSON style)
    if (/[,\s]$/.test(s)) {
      try { return { success: true, data: JSON.parse(s.replace(/[\s,]+$/, '')) } } catch {}
    }
    return { success: false, error: e as SyntaxError }
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export function parseSessionMetaLine(line: string): SafeResult<SessionMetaParsed> {
  const j = tryParseJson(line)
  if (!j.success) return { success: false, error: j.error, reason: 'invalid_json' }
  let payload: unknown = j.data
  // Unwrap common wrappers like { record_type: 'meta', record: { ... } }
  if (isRecord(payload)) {
    const rt = (payload as any).record_type || (payload as any).recordType
    if (typeof rt === 'string' && rt.toLowerCase() === 'meta') {
      const inner = (payload as any).record || (payload as any).data || (payload as any).payload
      if (inner && typeof inner === 'object') payload = inner
    }
    // Also support exporters that use { type: 'session_meta', payload: { ... } }
    const t = (payload as any).type
    if (typeof t === 'string' && t.toLowerCase() === 'session_meta') {
      const inner = (payload as any).payload || (payload as any).data || (payload as any).record
      if (inner && typeof inner === 'object') payload = inner
    }
  }
  const res = SessionMetaSchema.safeParse(payload)
  if (!res.success) return { success: false, error: res.error, reason: 'invalid_schema' }
  return { success: true, data: res.data }
}

export function parseResponseItemLine(line: string): SafeResult<ResponseItemParsed> {
  const j = tryParseJson(line)
  if (!j.success) return { success: false, error: j.error, reason: 'invalid_json' }

  // Unwrap foreign wrappers first (e.g., { record_type: 'event', record: { ... } })
  let payload: unknown = j.data
  if (isRecord(payload)) {
    const rt = (payload as any).record_type || (payload as any).recordType
    if (typeof rt === 'string') {
      const rtl = rt.toLowerCase()
      if (rtl === 'event' || rtl === 'trace' || rtl === 'log') {
        const inner = (payload as any).record || (payload as any).event || (payload as any).payload || (payload as any).data || (payload as any).item
        if (inner && typeof inner === 'object') payload = inner
      } else if (rtl === 'state') {
        // Let caller decide to skip state; represent as Other here for resilience
        const fallback = { type: 'Other', data: payload }
        const alt = ResponseItemSchema.safeParse(fallback)
        if (alt.success) return { success: true, data: alt.data }
      }
    }
    // Unwrap Codex CLI style wrappers: { type: 'response_item'|'event_msg', payload: { ... } }
    const t = (payload as any).type
    if (typeof t === 'string') {
      const tl = t.toLowerCase()
      if (tl === 'response_item' || tl === 'event_msg') {
        const inner = (payload as any).payload || (payload as any).data || (payload as any).record || (payload as any).event || (payload as any).item
        if (inner && typeof inner === 'object') {
          // Propagate timestamp if present
          if (typeof (payload as any).timestamp === 'string' && !(inner as any).at) (inner as any).at = (payload as any).timestamp
          payload = inner
        }
      }
    }
  }

  // Try normalization of foreign event shapes (lowercase types, nested payloads, snake_case)
  if (isRecord(payload)) {
    const normalized = normalizeForeignEventShape(payload)
    if (normalized) {
      const normRes = ResponseItemSchema.safeParse(normalized)
      if (normRes.success) return { success: true, data: normRes.data }
    }
  }

  // Fallback: strict schema as-is
  const res = ResponseItemSchema.safeParse(payload)
  if (res.success) return { success: true, data: res.data }

  // Fallback: if discriminator is unknown/missing, coerce to Other-event to avoid hard failure
  // Preserve base fields when available, and tuck the original payload under `data`.
  if (isRecord(payload)) {
    const base = payload
    const t = typeof (base as any).type === 'string' ? (base as any).type : undefined
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
    // Only coerce to Other when type is missing or unknown
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

function extractReasoningContent(src: Record<string, any>): string | null {
  let content = flattenContent(src.content)
  if (typeof content === 'string' && content.trim() !== '') return content
  const summary = flattenContent(src.summary)
  if (typeof summary === 'string' && summary.trim() !== '') return summary
  if ('encryptedContent' in src) return '[encrypted]'
  return null
}

function tryParseJsonText(s?: string): unknown {
  if (!s) return undefined
  try { return JSON.parse(s) } catch { return s }
}

function extractMessageFromResponse(resp: any): string | undefined {
  if (!resp || typeof resp !== 'object') return undefined
  // Common shapes: { output_text: ["...", "..."] }
  if (Array.isArray(resp.output_text) && resp.output_text.length) {
    return resp.output_text.map((x: any) => (typeof x === 'string' ? x : asString(x) ?? '')).join('\n')
  }
  // { output: [{ content: [{ type: 'text', text: '...' }, ...] }, ...] }
  if (Array.isArray(resp.output)) {
    const parts: string[] = []
    for (const seg of resp.output) {
      const content = (seg && typeof seg === 'object' && Array.isArray((seg as any).content)) ? (seg as any).content : null
      if (content) {
        const text = flattenContent(content)
        if (text) parts.push(text)
      }
    }
    if (parts.length) return parts.join('\n')
  }
  return undefined
}

function normalizeForeignEventShape(data: Record<string, unknown>): Record<string, unknown> | null {
  // tolerate snake_case base fields
  const base = toCamel(data)
  // Gather potential type fields and normalize
  const rawTypeCandidate = [
    (base as any).type,
    (base as any).eventType,
    (base as any).event,
    (base as any).kind,
    (base as any).action,
    (base as any).category,
  ].find((v) => typeof v === 'string') as string | undefined
  const t = rawTypeCandidate
    ? String(rawTypeCandidate)
        .toLowerCase()
        .replace(/[-\s]+/g, '_')
        .split(/[.:/]/)[0] // keep the head: message.created -> message
    : undefined

  // Some lines are state markers; keep as Other to avoid noise in timeline logic
  if (!t && typeof (base as any).record_type === 'string') {
    return { type: 'Other', id: asString(base.id), at: asString(base.at), index: (base as any).index, data: data }
  }

  switch (t) {
    // Codex CLI event_msg subtypes
    case 'agent_reasoning': {
      const content = extractReasoningContent({
        content: (base as any).text ?? (base as any).content,
        summary: (base as any).summary,
        encryptedContent: (base as any).encryptedContent,
      })
      if (content == null) return null
      return { type: 'Reasoning', content, id: base.id, at: base.at, index: base.index }
    }
    case 'agent_message': {
      const content = flattenContent((base as any).message ?? (base as any).text ?? (base as any).content)
      if (content == null) return null
      const model = typeof (base as any).model === 'string' ? (base as any).model : undefined
      return { type: 'Message', role: 'assistant', content, model, id: base.id, at: base.at, index: base.index }
    }
    case 'summary_text': {
      const content = flattenContent((base as any).text ?? (base as any).content)
      if (content == null) return null
      return { type: 'Message', role: 'assistant', content, id: base.id, at: base.at, index: base.index }
    }
    case 'tool_call':
    case 'functioncall':
    case 'function_call': {
      const callId = asString((base as any).call_id) ?? asString((base as any).callId)
      const name = asString((base as any).tool) ?? asString((base as any).name) ?? 'tool'
      // Special-case: a "shell" function call represents a local shell command.
      if (name === 'shell') {
        const argsRaw = (base as any).arguments ?? (base as any).args
        const parsed = typeof argsRaw === 'string' ? tryParseJsonText(argsRaw) : argsRaw
        const argObj = isRecord(parsed) ? parsed : undefined
        const command = asString(argObj?.command) ?? ''
        const cwd = asString(argObj?.cwd)
        return {
          type: 'LocalShellCall',
          command,
          cwd,
          id: callId ?? base.id,
          call_id: callId,
          at: base.at,
          index: base.index,
        }
      }
      return {
        type: 'FunctionCall',
        name,
        args: (base as any).args ?? (base as any).arguments,
        result: (base as any).output ?? (base as any).result,
        id: callId ?? base.id,
        call_id: callId,
        at: base.at,
        index: base.index,
      }
    }
    case 'tool_call_output':
    case 'function_call_output':
    case 'tool_result': {
      const name = asString((base as any).tool) ?? asString((base as any).name) ?? 'tool'
      const callId = asString((base as any).call_id) ?? asString((base as any).callId)
      const rawVal = (base as any).output ?? (base as any).result
      // Shell tools typically return JSON with stdout/stderr/exit codes
      if (name === 'shell') {
        const parsed = typeof rawVal === 'string' ? tryParseJsonText(rawVal) : rawVal
        const out = isRecord(parsed) ? parsed : { stdout: parsed }
        const exitCode = typeof (out as any).exitCode === 'number'
          ? (out as any).exitCode
          : typeof (out as any).exit_code === 'number'
          ? (out as any).exit_code
          : undefined
        const durationMs = typeof (out as any).durationMs === 'number'
          ? (out as any).durationMs
          : typeof (out as any).duration_ms === 'number'
          ? (out as any).duration_ms
          : undefined
        return {
          type: 'LocalShellCall',
          command: asString((out as any).command) ?? '',
          cwd: asString((out as any).cwd),
          stdout: asString((out as any).stdout),
          stderr: asString((out as any).stderr),
          exitCode,
          durationMs,
          id: callId ?? base.id,
          call_id: callId,
          at: base.at,
          index: base.index,
        }
      }
      const raw = asString(rawVal)
      const parsed = tryParseJsonText(raw)
      // If parsed is array of {text}, join into string for readability
      let result: unknown = parsed
      if (Array.isArray(parsed) && parsed.every((x) => x && typeof x === 'object' && 'text' in (x as any))) {
        result = (parsed as any[]).map((x) => (x as any).text).join('\n')
      }
      return { type: 'FunctionCall', name, result, id: callId ?? base.id, call_id: callId, at: base.at, index: base.index }
    }
    case 'message': {
      const role = typeof base.role === 'string' ? base.role : 'assistant'
      const content = flattenContent((base as any).content) ?? extractMessageFromResponse((base as any).response)
      if (content == null) return null
      const model = typeof (base as any).model === 'string' ? (base as any).model : undefined
      return { type: 'Message', role, content, model, id: base.id, at: base.at, index: base.index }
    }
    case 'assistant_message':
    case 'user_message':
    case 'system_message':
    case 'assistant':
    case 'user':
    case 'system': {
      const role = t === 'assistant_message' || t === 'assistant' ? 'assistant' : t === 'user_message' || t === 'user' ? 'user' : 'system'
      const content = flattenContent((base as any).content ?? (base as any).text ?? (base as any).message)
      if (content == null) return null
      const model = typeof (base as any).model === 'string' ? (base as any).model : undefined
      return { type: 'Message', role, content, model, id: base.id, at: base.at, index: base.index }
    }
    case 'reasoning': {
      const content = extractReasoningContent(base as any)
      if (content == null) return null
      return { type: 'Reasoning', content, id: base.id, at: base.at, index: base.index }
    }
    // Removed duplicate function_call / function_call_output cases (handled above)
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
    case 'file_write':
    case 'file_written':
    case 'file_update':
    case 'file_updated':
    case 'patch':
    case 'diff': {
      return {
        type: 'FileChange',
        path: asString((base as any).path ?? (base as any).file ?? (base as any).filename) ?? '',
        diff: asString((base as any).diff ?? (base as any).patch ?? (base as any).output ?? (base as any).result),
        id: base.id, at: base.at, index: base.index,
      }
    }
  }

  // Unrecognized -> let fallback handle as Other
  // Heuristic fallback: infer type by shape when `type` is missing or unknown
  try {
    // File change by presence of path + (diff|patch)
    if (typeof (base as any).path === 'string' && (typeof (base as any).diff === 'string' || typeof (base as any).patch === 'string')) {
      return { type: 'FileChange', path: String((base as any).path), diff: asString((base as any).diff ?? (base as any).patch), id: base.id, at: base.at, index: base.index }
    }
    // Local shell by presence of command
    if (typeof (base as any).command === 'string') {
      const exitCode = typeof (base as any).exitCode === 'number' ? (base as any).exitCode
        : typeof (base as any).exit_code === 'number' ? (base as any).exit_code : undefined
      const durationMs = typeof (base as any).durationMs === 'number' ? (base as any).durationMs
        : typeof (base as any).duration_ms === 'number' ? (base as any).duration_ms : undefined
      return { type: 'LocalShellCall', command: String((base as any).command), cwd: asString((base as any).cwd), exitCode, stdout: asString((base as any).stdout), stderr: asString((base as any).stderr), durationMs, id: base.id, at: base.at, index: base.index }
    }
    // Web search by presence of query + results array
    if (typeof (base as any).query === 'string' && Array.isArray((base as any).results)) {
      const results = (base as any).results as any[]
      return {
        type: 'WebSearchCall',
        query: String((base as any).query),
        provider: asString((base as any).provider),
        results: results?.map((r) => ({ title: asString((r as any).title), url: asString((r as any).url), snippet: asString((r as any).snippet) })),
        id: base.id, at: base.at, index: base.index,
      }
    }
    // Generic function call by toolName/name + (args|result|output)
    if ((typeof (base as any).toolName === 'string' || typeof (base as any).name === 'string') && ((base as any).args != null || (base as any).result != null || (base as any).output != null)) {
      const callId = asString((base as any).call_id) ?? asString((base as any).callId)
      return {
        type: 'FunctionCall',
        name: asString((base as any).toolName) ?? asString((base as any).name) ?? 'tool',
        args: (base as any).args,
        result: (base as any).result ?? (base as any).output,
        id: callId ?? base.id,
        call_id: callId,
        at: base.at,
        index: base.index,
      }
    }
    // Message by role + content-ish
    if (typeof (base as any).role === 'string' && ((base as any).content != null || (base as any).text != null)) {
      const content = flattenContent((base as any).content ?? (base as any).text)
      if (content != null) return { type: 'Message', role: String((base as any).role), content, id: base.id, at: base.at, index: base.index }
    }
  } catch {}
  return null
}
