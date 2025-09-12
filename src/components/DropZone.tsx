import React from 'react'
import { Card, CardContent } from './ui/card'

export interface DropZoneProps {
  onFile: (file: File) => void
  acceptExtensions?: string[] // e.g. ['.jsonl', '.txt']
  className?: string
}

function pickFirstAccepted(files: FileList | undefined, acceptExts: string[]): File | null {
  if (!files || files.length === 0) return null
  const lowerExts = acceptExts.map((e) => e.toLowerCase())
  for (const f of Array.from(files)) {
    const name = f.name.toLowerCase()
    const matched = lowerExts.length === 0 || lowerExts.some((ext) => name.endsWith(ext))
    if (matched) return f
  }
  return null
}

export function DropZone({ onFile, acceptExtensions = ['.jsonl', '.txt'], className }: DropZoneProps) {
  const [isOver, setIsOver] = React.useState(false)
  const inputId = React.useId()

  const acceptAttr = React.useMemo(() => {
    const extras = ['application/x-ndjson']
    return [...acceptExtensions, ...extras].join(',')
  }, [acceptExtensions])

  function onDragOver(e: React.DragEvent<HTMLElement>) {
    e.preventDefault() // Required to allow drop per HTML5 DnD
    setIsOver(true)
  }
  function onDragLeave() {
    setIsOver(false)
  }
  function onDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault()
    setIsOver(false)
    const file = pickFirstAccepted(e.dataTransfer?.files, acceptExtensions)
    if (file) onFile(file)
  }
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = pickFirstAccepted(e.target.files ?? undefined, acceptExtensions)
    if (file) onFile(file)
    e.target.value = ''
  }

  // Ensure Preline FileUpload is initialized for styling/behavior consistency
  React.useEffect(() => {
    try {
      // @ts-ignore - provided by @preline/file-upload UMD
      if (typeof window !== 'undefined' && (window as any).HSFileUpload?.autoInit) {
        setTimeout(() => {
          try { (window as any).HSFileUpload.autoInit() } catch {}
        }, 0)
      }
    } catch {}
  }, [])

  return (
    <Card className={className}>
      <CardContent className="p-0">
        <div data-hs-file-upload className="m-2">
          <label
            htmlFor={inputId}
            onDragOver={onDragOver}
            onDragEnter={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={
              `relative block w-full p-6 text-center border-2 border-dashed rounded cursor-pointer transition ${
                isOver ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300 bg-white'
              }`
            }
          >
            <input
              id={inputId}
              type="file"
              accept={acceptAttr}
              className="sr-only"
              onChange={onChange}
              aria-label="Choose .jsonl file"
            />
            <span className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>
                <span className="font-medium text-gray-900">Click to upload</span>
                <span className="mx-1">or</span>
                <span>drag and drop a <code>.jsonl</code> file</span>
              </span>
            </span>
            <span className="mt-2 block text-xs text-gray-500">Accepted: .jsonl, .txt</span>
          </label>
        </div>
      </CardContent>
    </Card>
  )
}

export default DropZone
