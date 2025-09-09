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

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault() // Required to allow drop per HTML5 DnD
    setIsOver(true)
  }
  function onDragLeave() {
    setIsOver(false)
  }
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsOver(false)
    const file = pickFirstAccepted(e.dataTransfer?.files, acceptExtensions)
    if (file) onFile(file)
  }

  return (
    <Card className={className}>
      <CardContent className="p-0">
        <div
          role="button"
          aria-label="Drop .jsonl file here"
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={
            `m-2 border-2 border-dashed rounded p-6 text-center transition ${
              isOver ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'
            }`
          }
        >
          <p className="text-sm text-gray-600">
            Drag and drop a <code>.jsonl</code> file here
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default DropZone
