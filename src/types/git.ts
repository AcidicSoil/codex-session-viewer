import type { ISO8601String } from './primitives'

/** Minimal git info attached to sessions. Expand as needed. */
export interface GitInfo {
  readonly repo?: string
  readonly branch?: string
  readonly commit?: string
  readonly remote?: string
  readonly dirty?: boolean
}
