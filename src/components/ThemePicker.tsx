import { useEffect, useMemo, useState } from 'react'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import { useTheme } from '../state/theme'

const modes = ['light', 'dark', 'system'] as const
const swatches: Record<string, string> = {
  teal: '#0d9488',
  rose: '#f43f5e',
  indigo: '#4f46e5',
}

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
  const {
    theme,
    mode,
    setTheme,
    setMode,
    customPrimary,
    setCustomPrimary,
    customBackground,
    setCustomBackground,
  } = useTheme()
  const [hex, setHex] = useState<string>(customPrimary ?? swatches[theme] ?? '#0d9488')
  const [bgHex, setBgHex] = useState<string>(customBackground ?? '#ffffff')
  const [contrastWarn, setContrastWarn] = useState<string | null>(null)

  // Sync local input with store
  useEffect(() => {
    setHex(customPrimary ?? swatches[theme] ?? '#0d9488')
    setBgHex(customBackground ?? '#ffffff')
  }, [customPrimary, customBackground, theme])

  // Apply custom colors only when user edits them to avoid overriding
  // the stock theme values on initial mount.
  // Directly update the store from the change handlers below.

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
  }, [theme, mode, customPrimary, customBackground, computeContrast])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">Primary Color</div>
          <div className="flex items-center gap-3">
            <div className="w-40">
              <HexColorPicker
                color={hex}
                onChange={(c) => { setHex(c); setCustomPrimary(c) }}
                className="h-28 w-40"
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs">Hex</span>
                <div className="flex items-center gap-1 border rounded px-2 py-1 bg-background text-foreground">
                  <span className="text-xs">#</span>
                  <HexColorInput
                    color={hex}
                    onChange={(c) => { setHex(c); setCustomPrimary(c) }}
                    prefixed={false}
                    className="text-sm w-24 outline-none bg-transparent"
                    aria-label="Primary color hex"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {Object.entries(swatches).map(([name, value]) => (
                  <button
                    key={name}
                    type="button"
                    className="h-6 w-6 rounded border ring-0"
                    style={{ backgroundColor: value }}
                    title={name}
                    onClick={() => { setTheme(name as any); setCustomPrimary(null) }}
                    aria-label={`Set ${name} theme`}
                  />
                ))}
                <button
                  type="button"
                  className="ml-1 text-xs underline"
                  onClick={() => { setTheme('teal'); setCustomPrimary(null) }}
                  title="Reset to theme defaults"
                >Reset</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">Background</div>
          <div className="flex items-center gap-3">
            <div className="w-40">
              <HexColorPicker
                color={bgHex}
                onChange={(c) => { setBgHex(c); setCustomBackground(c) }}
                className="h-28 w-40"
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs">Hex</span>
                <div className="flex items-center gap-1 border rounded px-2 py-1 bg-background text-foreground">
                  <span className="text-xs">#</span>
                  <HexColorInput
                    color={bgHex}
                    onChange={(c) => { setBgHex(c); setCustomBackground(c) }}
                    prefixed={false}
                    className="text-sm w-24 outline-none bg-transparent"
                    aria-label="Background color hex"
                  />
                </div>
              </div>
              <button
                type="button"
                className="ml-1 text-xs underline self-start"
                onClick={() => setCustomBackground(null)}
                title="Reset background"
              >Reset</button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm">Mode</label>
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
      </div>

      {contrastWarn && (
        <span className="ml-2 text-xs text-amber-700" role="status">{contrastWarn}</span>
      )}
    </div>
  )
}
