export type HashMap = Record<string, string>

export function parseHash(hash: string = window.location.hash): HashMap {
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  const out: HashMap = {}
  if (!h) return out
  for (const part of h.split('&')) {
    if (!part) continue
    const [k, v = ''] = part.split('=')
    if (!k) continue
    out[decodeURIComponent(k)] = decodeURIComponent(v)
  }
  return out
}

export function stringifyHash(map: HashMap): string {
  const parts = Object.entries(map)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  return parts.length ? `#${parts.join('&')}` : ''
}

export function setHash(map: HashMap) {
  const next = stringifyHash(map)
  if (window.location.hash !== next) {
    window.location.hash = next
  }
}

export function updateHash(updater: (prev: HashMap) => HashMap) {
  const prev = parseHash()
  setHash(updater(prev))
}

