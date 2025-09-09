import type { SessionMetaParsed, ResponseItemParsed } from './schemas'
import { parseSessionMetaLine, parseResponseItemLine, type SafeResult } from './validators'
import type { ParseFailureReason } from './validators'
import { streamTextLines } from '../utils/lineReader'

export interface ParserError {
  readonly line: number
  readonly reason: ParseFailureReason
  readonly message: string
  readonly raw: string
}

export interface ParserStats {
  readonly totalLines: number
  readonly parsedEvents: number
  readonly failedLines: number
  readonly durationMs: number
}

export interface ParserOptions {
  readonly maxErrors?: number
}

export type ParserEvent =
  | { kind: 'meta'; line: 1; meta: SessionMetaParsed; version: string | number }
  | { kind: 'event'; line: number; event: ResponseItemParsed }
  | { kind: 'error'; error: ParserError }
  | { kind: 'done'; stats: ParserStats }

function pickVersion(meta: SessionMetaParsed | undefined): string | number {
  const v = meta?.version
  if (v === undefined || v === null || v === '') return 1
  return v
}

export async function* streamParseSession(
  blob: Blob,
  opts: ParserOptions = {},
): AsyncGenerator<ParserEvent> {
  const started = performance.now?.() ?? Date.now()
  let total = 0
  let parsed = 0
  let failed = 0
  const maxErrors = opts.maxErrors ?? Number.POSITIVE_INFINITY

  let meta: SessionMetaParsed | undefined
  let version: string | number = 1

  let lineNo = 0
  for await (const line of streamTextLines(blob)) {
    lineNo++
    total++

    if (lineNo === 1) {
      const res = parseSessionMetaLine(line)
      if (!res.success) {
        failed++
        yield {
          kind: 'error',
          error: {
            line: lineNo,
            reason: res.reason,
            message: res.error.message,
            raw: line,
          },
        }
        if (failed >= maxErrors) break
      } else {
        meta = res.data
        version = pickVersion(meta)
        yield { kind: 'meta', line: 1, meta, version }
      }
      continue
    }

    // Skip internal state records produced by some session exporters
    // These lines have shape: { "record_type": "state", ... }
    try {
      if (line.trim().startsWith('{')) {
        const obj = JSON.parse(line) as any
        if (obj && typeof obj === 'object' && obj.record_type === 'state') {
          // do not count as parsed or failed; just skip showing in timeline
          continue
        }
      }
    } catch {
      // fall through to normal parsing which will report an error
    }

    const res = parseLineByVersion(version, line)
    if (!res.success) {
      failed++
      yield {
        kind: 'error',
        error: {
          line: lineNo,
          reason: res.reason,
          message: res.error.message,
          raw: line,
        },
      }
      if (failed >= maxErrors) break
    } else {
      parsed++
      yield { kind: 'event', line: lineNo, event: res.data }
    }
  }

  const ended = performance.now?.() ?? Date.now()
  yield {
    kind: 'done',
    stats: {
      totalLines: total,
      parsedEvents: parsed,
      failedLines: failed,
      durationMs: Math.max(0, ended - started),
    },
  }
}

function parseLineByVersion(
  version: string | number,
  line: string,
): SafeResult<ResponseItemParsed> {
  // Version routing hook. For now, v1 uses the same event parser.
  // Future versions can switch on `version` to use alternate schemas.
  return parseResponseItemLine(line)
}

export async function parseSessionToArrays(blob: Blob, opts: ParserOptions = {}) {
  const errors: ParserError[] = []
  const events: ResponseItemParsed[] = []
  let meta: SessionMetaParsed | undefined
  let stats: ParserStats | undefined

  for await (const item of streamParseSession(blob, opts)) {
    if (item.kind === 'meta') meta = item.meta
    else if (item.kind === 'event') events.push(item.event)
    else if (item.kind === 'error') errors.push(item.error)
    else if (item.kind === 'done') stats = item.stats
  }

  return { meta, events, errors, stats }
}
