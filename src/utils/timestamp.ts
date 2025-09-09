export function parseTimestampFromPath(p: string): number | null {
  const iso = p.match(/(20\d{2})-(\d{2})-(\d{2})[T_](\d{2})[-_](\d{2})(?:[-_](\d{2}))?/)
  if (iso) {
    const [, yStr, moStr, dStr, hStr, miStr, sStr] = iso
    const y = Number(yStr)
    const mo = Number(moStr)
    const d = Number(dStr)
    const h = Number(hStr)
    const mi = Number(miStr)
    const s = sStr === undefined ? 0 : Number(sStr)
    if (
      mo >= 1 && mo <= 12 &&
      d >= 1 && d <= 31 &&
      h >= 0 && h < 24 &&
      mi >= 0 && mi < 60 &&
      s >= 0 && s < 60
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
