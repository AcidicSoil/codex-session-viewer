import { z } from 'zod'

// Keep schemas forward-compatible with passthrough() to tolerate unknown keys

export const GitInfoSchema = z.object({
  repo: z.string().optional(),
  branch: z.string().optional(),
  commit: z.string().optional(),
  remote: z.string().optional(),
  dirty: z.boolean().optional(),
}).passthrough()

export const SessionMetaSchema = z.object({
  id: z.string().min(1, 'id required'),
  timestamp: z.string().min(1, 'timestamp required'), // allow any ISO-like string; refine later if needed
  instructions: z.string().optional(),
  git: GitInfoSchema.optional(),
  version: z.union([z.number(), z.string()]).optional(),
}).passthrough()

// Base event fields
const BaseEvent = z.object({
  id: z.string().optional(),
  at: z.string().optional(),
  index: z.number().int().optional(),
}).passthrough()

const MessageEventSchema = BaseEvent.extend({
  type: z.literal('Message'),
  role: z.string(),
  content: z.string(),
  model: z.string().optional(),
})

const ReasoningEventSchema = BaseEvent.extend({
  type: z.literal('Reasoning'),
  content: z.string(),
})

const FunctionCallEventSchema = BaseEvent.extend({
  type: z.literal('FunctionCall'),
  name: z.string(),
  args: z.unknown().optional(),
  result: z.unknown().optional(),
  durationMs: z.number().optional(),
})

const LocalShellCallEventSchema = BaseEvent.extend({
  type: z.literal('LocalShellCall'),
  command: z.string(),
  cwd: z.string().optional(),
  exitCode: z.number().int().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  durationMs: z.number().optional(),
})

const WebSearchCallEventSchema = BaseEvent.extend({
  type: z.literal('WebSearchCall'),
  query: z.string(),
  provider: z.string().optional(),
  results: z.array(
    z.object({
      title: z.string().optional(),
      url: z.string().optional(),
      snippet: z.string().optional(),
    }).passthrough(),
  ).optional(),
})

const CustomToolCallEventSchema = BaseEvent.extend({
  type: z.literal('CustomToolCall'),
  toolName: z.string(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
})

const FileChangeEventSchema = BaseEvent.extend({
  type: z.literal('FileChange'),
  path: z.string(),
  diff: z.string().optional(),
})

const OtherEventSchema = BaseEvent.extend({
  type: z.literal('Other'),
  data: z.unknown().optional(),
})

export const ResponseItemSchema = z.discriminatedUnion('type', [
  MessageEventSchema,
  ReasoningEventSchema,
  FunctionCallEventSchema,
  LocalShellCallEventSchema,
  WebSearchCallEventSchema,
  CustomToolCallEventSchema,
  FileChangeEventSchema,
  OtherEventSchema,
])

export type SessionMetaParsed = z.infer<typeof SessionMetaSchema>
export type ResponseItemParsed = z.infer<typeof ResponseItemSchema>
