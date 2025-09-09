import type { ResponseItemParsed } from '../parser'

// Produce a minimal unified diff for a single-file, single-hunk edit so the
// DiffViewer can reconstruct original/modified sides meaningfully.
function makeUnifiedDiff(path: string, i: number): string {
  // Keep the first line unchanged (context), modify the second line.
  // The parser only relies on line prefixes (" ", "+", "-") and the
  // presence of a hunk header starting with "@@".
  return (
    `--- a/${path}\n` +
    `+++ b/${path}\n` +
    `@@ -1,2 +1,2 @@\n` +
    ` export const value = ${i};\n` +
    `-console.log("old ${i}");\n` +
    `+console.log("new ${i}");\n`
  )
}

export function generateSyntheticEvents(count: number): ResponseItemParsed[] {
  const items: ResponseItemParsed[] = []
  const now = Date.now()
  for (let i = 0; i < count; i++) {
    const t = i % 4
    if (t === 0) {
      // Message
      items.push({
        type: 'Message',
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Synthetic message #${i} Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer ${i}`,
        id: `m-${i}`,
        at: new Date(now + i * 10).toISOString(),
        index: i,
        model: 'fake-model',
      } as any)
    } else if (t === 1) {
      // LocalShellCall
      items.push({
        type: 'LocalShellCall',
        command: 'echo',
        stdout: `Hello ${i}`,
        exitCode: 0,
        id: `s-${i}`,
        at: new Date(now + i * 10).toISOString(),
        index: i,
      } as any)
    } else if (t === 2) {
      // FileChange with a proper unified diff
      const path = `src/file${i}.ts`
      items.push({
        type: 'FileChange',
        path,
        diff: makeUnifiedDiff(path, i),
        id: `f-${i}`,
        at: new Date(now + i * 10).toISOString(),
        index: i,
      } as any)
    } else {
      // Other
      items.push({
        type: 'Other',
        data: { i, note: 'synthetic' },
        id: `o-${i}`,
        at: new Date(now + i * 10).toISOString(),
        index: i,
      } as any)
    }
  }
  return items
}
