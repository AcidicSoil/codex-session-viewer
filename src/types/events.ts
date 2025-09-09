import type { ISO8601String, Id, FilePath } from './primitives'

/** Base event fields shared by all timeline items. */
export interface BaseEvent {
  readonly id?: Id<'event'> | string
  readonly at?: ISO8601String | string
  readonly index?: number
}

/**
 * Message emitted by user/assistant/system.
 */
export interface MessageEvent extends BaseEvent {
  readonly type: 'Message'
  readonly role: 'user' | 'assistant' | 'system' | string
  readonly content: string
  readonly model?: string
}

/**
 * Model reasoning trace (if available). Content is plain text/markdown.
 */
export interface ReasoningEvent extends BaseEvent {
  readonly type: 'Reasoning'
  readonly content: string
}

/**
 * Generic function/tool call with structured arguments.
 */
export interface FunctionCallEvent extends BaseEvent {
  readonly type: 'FunctionCall'
  readonly name: string
  readonly args?: unknown
  readonly result?: unknown
  readonly durationMs?: number
}

/**
 * Local shell command execution event.
 */
export interface LocalShellCallEvent extends BaseEvent {
  readonly type: 'LocalShellCall'
  readonly command: string
  readonly cwd?: FilePath | string
  readonly exitCode?: number
  readonly stdout?: string
  readonly stderr?: string
  readonly durationMs?: number
}

/**
 * Web search action event.
 */
export interface WebSearchCallEvent extends BaseEvent {
  readonly type: 'WebSearchCall'
  readonly query: string
  readonly provider?: string
  readonly results?: ReadonlyArray<{ title?: string; url?: string; snippet?: string }>
}

/**
 * Custom/plugin tool call envelope for unknown tool types.
 */
export interface CustomToolCallEvent extends BaseEvent {
  readonly type: 'CustomToolCall'
  readonly toolName: string
  readonly input?: unknown
  readonly output?: unknown
}

/**
 * File change event referencing modified paths.
 */
export interface FileChangeEvent extends BaseEvent {
  readonly type: 'FileChange'
  readonly path: FilePath | string
  readonly diff?: string
}

/**
 * Fallback for unrecognized records. Preserves the raw payload.
 */
export interface OtherEvent extends BaseEvent {
  readonly type: 'Other'
  readonly data?: unknown
}

/**
 * Discriminated union of all supported event variants.
 */
export type ResponseItem =
  | MessageEvent
  | ReasoningEvent
  | FunctionCallEvent
  | LocalShellCallEvent
  | WebSearchCallEvent
  | CustomToolCallEvent
  | FileChangeEvent
  | OtherEvent
