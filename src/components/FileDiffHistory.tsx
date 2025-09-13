import * as React from 'react'

export interface FileDiffHistoryProps {
  filePath: string
  diffs: readonly { diff?: string; at?: string; index?: number }[]
}

export default function FileDiffHistory({ filePath, diffs }: FileDiffHistoryProps) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    try {
      // @ts-ignore - provided by @preline/accordion UMD
      const API = (typeof window !== 'undefined') ? (window as any).HSAccordion : undefined
      if (API?.autoInit) {
        const t = setTimeout(() => {
          try { API.autoInit() } catch {}
        }, 0)
        return () => clearTimeout(t)
      }
    } catch {}
  }, [diffs])

  return (
    <div ref={wrapperRef} className="hs-accordion-group border rounded" data-hs-accordion>
      {diffs.map((d, i) => (
        <div key={i} className="hs-accordion border-b last:border-b-0">
          <button
            className="hs-accordion-toggle py-2 px-2 w-full text-left flex justify-between items-center"
            type="button"
          >
            <span>{d.at ?? `Change ${i + 1}`}</span>
            <svg
              className="hs-accordion-active:rotate-180 w-3 h-3 transition-transform"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 8l4 4 4-4" />
            </svg>
          </button>
          <div className="hs-accordion-content hidden w-full overflow-auto" role="region">
            <pre className="bg-gray-50 p-2 text-xs overflow-auto" aria-label={`Diff ${i + 1}`}>
              {d.diff ?? ''}
            </pre>
          </div>
        </div>
      ))}
    </div>
  )
}

