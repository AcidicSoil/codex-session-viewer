export function parseTimestampFromPath(p: string): number | null {
  const m2 = p.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})T(\d{2})[-_]?(\d{2})[-_]?(\d{2})/)
  if (m2) {
    const y = Number(m2[1])
    const mo = Number(m2[2])
    const d = Number(m2[3])
    const h = Number(m2[4])
    const mi = Number(m2[5])
    const s = Number(m2[6])
    if (
      mo >= 1 &&
      mo <= 12 &&
      d >= 1 &&
      d <= 31 &&
      h >= 0 &&
      h <= 23 &&
      mi >= 0 &&
      mi <= 59 &&
      s >= 0 &&
      s <= 59
    ) {
      return Date.UTC(y, mo - 1, d, h, mi, s)
    }
  }
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
