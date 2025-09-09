export type TextStats = { bytes: number; lines: number; binary: boolean }

const NON_PRINTABLE_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g // allow \t, \n, \r

export function analyzeText(input: string): TextStats {
  const bytes = input.length
  const lines = input ? input.split(/\r?\n/).length : 0
  // Heuristic: any NUL or >2% non-printable indicates binary-ish content
  if (input.includes('\u0000')) return { bytes, lines, binary: true }
  const matches = input.match(NON_PRINTABLE_RE)
  const ratio = matches ? matches.length / Math.max(1, input.length) : 0
  const binary = ratio > 0.02
  return { bytes, lines, binary }
}

export function isTooLarge(input: string, opts?: { maxBytes?: number; maxLines?: number }): boolean {
  const { maxBytes = 200_000, maxLines = 10_000 } = opts || {}
  const s = analyzeText(input)
  return s.bytes > maxBytes || s.lines > maxLines
}

export function safeTruncate(input: string, maxBytes = 200_000): string {
  return input.length > maxBytes ? input.slice(0, maxBytes) + '\n… (truncated)' : input
}

export function analyzeDiff(diff?: string) {
  if (!diff) return { present: false, binary: false, large: false, stats: { bytes: 0, lines: 0, binary: false } }
  const stats = analyzeText(diff)
  const large = isTooLarge(diff, { maxBytes: 500_000, maxLines: 20_000 })
  return { present: true, binary: stats.binary, large, stats }
}

