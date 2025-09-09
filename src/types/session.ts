import type { ResponseItem } from "./events"
import type { ISO8601String, Id, FilePath } from './primitives'
import type { GitInfo } from './git'

/** Session-level metadata parsed from line 1 of the JSONL file. */
export interface SessionMeta {
  readonly id: Id<'session'> | string
  readonly timestamp: ISO8601String | string
  readonly instructions?: string
  readonly git?: GitInfo
  /** Optional schema versioning to mitigate drift */
  readonly version?: number | string
}

/** A single file change captured during the session. */
export interface FileChange {
  readonly path: FilePath | string
  /** Unified diff text if available. */
  readonly diff?: string
  /** Optional patch hunks or apply-patch snippets. */
  readonly patches?: readonly string[]
}

/** Artifact generated during the session (e.g., export, compiled asset). */
export interface Artifact {
  readonly name: string
  readonly path?: FilePath | string
  readonly contentType?: string
  readonly bytes?: Uint8Array
}

/** Parsed session bundle returned by the parser. */
export interface ParsedSession {
  readonly meta: SessionMeta
  readonly events: readonly ResponseItem[]
  readonly fileChanges: readonly FileChange[]
  readonly artifacts: readonly Artifact[]
}

// Event types imported from events.ts (circular-safe via type import)
export type { ResponseItem } from './events'
