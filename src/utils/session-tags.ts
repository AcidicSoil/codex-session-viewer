import { parseResponseItemLine, parseSessionMetaLine } from '../parser'
import type { ResponseItemParsed, SessionMetaParsed } from '../parser'

const MAX_TAGS_DEFAULT = 6

function normalizeTag(input: string): string {
  let value = input.trim()
  if (!value) return input.trim()
  value = value.replace(/\s+/g, ' ')
  // Collapse redundant trailing slashes
  value = value.replace(/[\\/]+$/g, '')
  return value || input.trim()
}

function collectCwdsFromValue(value: unknown, acc: Set<string>, seen: WeakSet<object>) {
  if (!value) return
  if (Array.isArray(value)) {
    for (const item of value) collectCwdsFromValue(item, acc, seen)
    return
  }
  if (typeof value !== 'object') return
  if (seen.has(value as object)) return
  seen.add(value as object)

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key === 'string' && key.toLowerCase() === 'cwd') {
      if (typeof nested === 'string') {
        const normalized = normalizeTag(nested)
        if (normalized) acc.add(normalized)
      } else if (Array.isArray(nested)) {
        for (const candidate of nested) {
          if (typeof candidate === 'string') {
            const normalized = normalizeTag(candidate)
            if (normalized) acc.add(normalized)
          }
        }
      }
    }
    collectCwdsFromValue(nested, acc, seen)
  }
}

function collectFromMeta(meta: SessionMetaParsed | undefined, acc: Set<string>) {
  if (!meta) return
  collectCwdsFromValue(meta as unknown as Record<string, unknown>, acc, new WeakSet())
}

function collectFromEvent(event: ResponseItemParsed, acc: Set<string>) {
  collectCwdsFromValue(event as unknown as Record<string, unknown>, acc, new WeakSet())
}

export function extractCwdTagsFromText(text: string, maxTags = MAX_TAGS_DEFAULT): string[] {
  const acc = new Set<string>()
  if (!text) return []
  const lines = text.split(/\r?\n/)
  let metaProcessed = false

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (!metaProcessed) {
      metaProcessed = true
      const metaResult = parseSessionMetaLine(line)
      if (metaResult.success) {
        collectFromMeta(metaResult.data, acc)
        if (acc.size >= maxTags) break
      }
      continue
    }

    const eventResult = parseResponseItemLine(line)
    if (!eventResult.success) continue
    collectFromEvent(eventResult.data, acc)
    if (acc.size >= maxTags) break
  }

  return Array.from(acc).slice(0, maxTags)
}

export async function fetchCwdTagsFromUrl(url: string, options?: { signal?: AbortSignal; maxTags?: number }): Promise<string[]> {
  const res = await fetch(url, { signal: options?.signal })
  if (!res.ok) {
    throw new Error(`Failed to fetch session: ${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  const limit = options?.maxTags ?? MAX_TAGS_DEFAULT
  return extractCwdTagsFromText(text, limit)
}

export function extractCwdTagsFromEvents(meta: SessionMetaParsed | undefined, events: readonly ResponseItemParsed[], maxTags = MAX_TAGS_DEFAULT): string[] {
  const acc = new Set<string>()
  collectFromMeta(meta, acc)
  for (const event of events) {
    collectFromEvent(event, acc)
    if (acc.size >= maxTags) break
  }
  return Array.from(acc).slice(0, maxTags)
}
