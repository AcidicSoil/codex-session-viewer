export function parseUnifiedDiffToSides(diff: string): { original: string; modified: string } {
  const lines: string[] = diff.replace(/\r\n/g, '\n').split('\n')
  const orig: string[] = []
  const mod: string[] = []
  let inHunk = false

  for (const line of lines) {
    // Skip diff headers and metadata lines
    if (
      line.startsWith('diff ') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ')
    )
      continue
    if (line.startsWith('@@')) {
      inHunk = true
      // separate hunks visually
      if (orig.length > 0 || mod.length > 0) {
        orig.push('')
        mod.push('')
        orig.push('…')
        mod.push('…')
        orig.push('')
        mod.push('')
      }
      continue
    }
    if (!inHunk) continue
    if (line.startsWith(' ')) {
      const content = line.slice(1)
      orig.push(content)
      mod.push(content)
    } else if (line.startsWith('-')) {
      orig.push(line.slice(1))
    } else if (line.startsWith('+')) {
      mod.push(line.slice(1))
    } else if (line.startsWith('\\ No newline at end of file')) {
      // ignore metadata
    } else {
      // Fallback: treat as context
      orig.push(line)
      mod.push(line)
    }
  }

  return { original: orig.join('\n'), modified: mod.join('\n') }
}
