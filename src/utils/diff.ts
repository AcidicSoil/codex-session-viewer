export function parseUnifiedDiffToSides(diff: string): { original: string; modified: string } {
  const lines: string[] = diff.replace(/\r\n/g, '\n').split('\n')
  const orig: string[] = []
  const mod: string[] = []
  let inHunk = false

  for (const line of lines) {
    if (line.startsWith('--- ') || line.startsWith('+++ ')) continue
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

export function languageFromPath(path?: string): string | undefined {
  if (!path) return 'plaintext'
  const lower = path.toLowerCase()
  if (lower.endsWith('.ts')) return 'typescript'
  if (lower.endsWith('.tsx')) return 'typescript'
  if (lower.endsWith('.js')) return 'javascript'
  if (lower.endsWith('.jsx')) return 'javascript'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.md')) return 'markdown'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.scss')) return 'scss'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html'
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'yaml'
  if (lower.endsWith('.sh') || lower.endsWith('.bash')) return 'shell'
  if (lower.endsWith('.py')) return 'python'
  if (lower.endsWith('.rb')) return 'ruby'
  if (lower.endsWith('.go')) return 'go'
  if (lower.endsWith('.rs')) return 'rust'
  if (lower.endsWith('.java')) return 'java'
  if (lower.endsWith('.kt') || lower.endsWith('.kts')) return 'kotlin'
  if (lower.endsWith('.sql')) return 'sql'
  return 'plaintext'
}
