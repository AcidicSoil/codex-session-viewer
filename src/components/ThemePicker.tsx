import { useTheme } from '../state/theme'

const themes = ['teal', 'rose', 'indigo'] as const
const modes = ['light', 'dark', 'system'] as const

export default function ThemePicker() {
  const { theme, mode, setTheme, setMode } = useTheme()

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
    </div>
  )
}
