import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../state/theme'

const themes = ['slate'] as const
const modes = ['light', 'dark', 'system'] as const

function parseRGBTriplet(s: string): [number, number, number] | null {
  const parts = s.trim().split(/\s+/).map((n) => parseFloat(n))
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null
  return [parts[0]!, parts[1]!, parts[2]!] as [number, number, number]
}

function relLum([r, g, b]: [number, number, number]): number {
  const toLin = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const R = toLin(r), G = toLin(g), B = toLin(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const L1 = relLum(a)
  const L2 = relLum(b)
  const hi = Math.max(L1, L2)
  const lo = Math.min(L1, L2)
  return (hi + 0.05) / (lo + 0.05)
}

export default function ThemePicker() {
  const { theme, mode, setTheme, setMode } = useTheme()
  const [contrastWarn, setContrastWarn] = useState<string | null>(null)

  const computeContrast = useMemo(() => () => {
    try {
      const cs = getComputedStyle(document.documentElement)
      const bg = parseRGBTriplet(cs.getPropertyValue('--background'))
      const fg = parseRGBTriplet(cs.getPropertyValue('--foreground'))
      const pr = parseRGBTriplet(cs.getPropertyValue('--primary'))
      if (!bg || !fg || !pr) return null
      const r1 = contrastRatio(pr, bg)
      const r2 = contrastRatio(fg, bg)
      const msgs: string[] = []
      if (r1 < 3) msgs.push(`Low contrast: primary vs background (${r1.toFixed(2)}:1)`) // button-sized
      if (r2 < 4.5) msgs.push(`Low contrast: text vs background (${r2.toFixed(2)}:1)`) // normal text
      return msgs.length ? msgs.join(' • ') : null
    } catch {
      return null
    }
  }, []);

  useEffect(() => {
    setContrastWarn(computeContrast())
  }, [theme, mode, computeContrast])

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm">Theme</label>
      <select
        className="border rounded px-2 py-1 text-sm bg-background text-foreground"
        value={theme}
        onChange={(e) => setTheme(e.target.value as any)}
      >
        {themes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <label className="text-sm ml-4">Mode</label>
      <select
        className="border rounded px-2 py-1 text-sm bg-background text-foreground"
        value={mode}
        onChange={(e) => setMode(e.target.value as any)}
      >
        {modes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      {contrastWarn && (
        <span className="ml-2 text-xs text-amber-700" role="status">{contrastWarn}</span>
      )}
    </div>
  )
}
