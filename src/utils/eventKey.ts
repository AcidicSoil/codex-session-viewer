import type { ResponseItem } from '../types'

export function eventKey(item: ResponseItem, absoluteIndex: number): string {
  const anyItem = item as any
  if (anyItem.id) return String(anyItem.id)
  if (typeof anyItem.index === 'number') return `idx-${anyItem.index}`
  return `idx-${absoluteIndex}`
}

