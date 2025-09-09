export function parseTimestampFromPath(p: string): number | null {
  const m1 = p.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/)
  if (m1) {
    const y = Number(m1[1])
    const mo = Number(m1[2])
    const d = Number(m1[3])
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return Date.UTC(y, mo - 1, d)
    }
  }
  const epoch = p.match(/(1\d{9}|2\d{9})/)
  if (epoch) return Number(epoch[1]) * 1000
  return null
}
