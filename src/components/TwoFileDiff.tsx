import * as React from 'react'
import DiffView from './DiffView'

/**
 * TwoFileDiff allows comparing any two local text files. Users can drag-and-drop
 * one or two files onto the drop zone or click to open the system file picker.
 * The first file becomes "File A" and the second becomes "File B". Errors are
 * surfaced for empty drops, unsupported types or duplicate files.
 */
export default function TwoFileDiff() {
  // File contents
  const [a, setA] = React.useState<string>('')
  const [b, setB] = React.useState<string>('')
  // File names for display
  const [nameA, setNameA] = React.useState<string>('')
  const [nameB, setNameB] = React.useState<string>('')
  // UI states for drag-over highlight and error messages
  const [isOver, setIsOver] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  /** Read file text and store based on slot */
  async function onPick(which: 'a' | 'b', file: File) {
    const text = await file.text()
    if (which === 'a') { setA(text); setNameA(file.name) }
    else { setB(text); setNameB(file.name) }
  }

  /** Determine whether a file appears text-like based on mime or extension */
  function isTextFile(file: File): boolean {
    return (
      file.type.startsWith('text/') ||
      /\.(json|txt|md|js|ts|tsx|css|html|c|h|py|java|go|rs|yml|yaml|csv)$/i.test(file.name)
    )
  }

  /**
   * Handle a list of dropped/selected files. Accepts one or two files. If one is
   * provided, it fills the next available slot (A then B). Two files replace both
   * slots. Duplicate file names/sizes or non-text files trigger an error.
   */
  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) {
      setError('No files provided')
      return
    }
    const files = Array.from(list)
    if (files.some((f) => !isTextFile(f))) {
      setError('Unsupported file type')
      return
    }
    setError(null)
    if (files.length === 1) {
      const target = a === '' ? 'a' : 'b'
      await onPick(target, files[0]!)
      if (target === 'a') setB('')
    } else {
      const [f1, f2] = files as [File, File, ...File[]]
      if (f1.name === f2.name && f1.size === f2.size) {
        setError('Duplicate files')
        return
      }
      await onPick('a', f1)
      await onPick('b', f2)
      if (files.length > 2) {
        setError('Only first two files were used')
      }
    }
  }

  // Drag and drop handlers
  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsOver(true)
  }
  function onDragLeave() { setIsOver(false) }
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsOver(false)
    void handleFiles(e.dataTransfer.files)
  }
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    void handleFiles(e.target.files)
    e.target.value = '' // allow re-selecting same file
  }

  return (
    <div className="space-y-3">
      <div
        data-testid="twofile-drop"
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`p-6 border-2 border-dashed rounded cursor-pointer text-center transition ${
          isOver ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300 bg-white'
        }`}
      >
        {nameA || nameB ? (
          <div className="text-sm">
            <div>File A: {nameA || '—'}</div>
            <div>File B: {nameB || '—'}</div>
            {!nameB && <div className="mt-1 text-gray-500">Drop or browse for another file</div>}
          </div>
        ) : (
          <div className="text-sm text-gray-600">Drop one or two text files here or click to browse</div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onChange}
      />
      {error && <div className="text-sm text-red-600">{error}</div>}
      {a !== '' && b !== '' && (
        <DiffView
          path={nameB || nameA || 'untitled'}
          original={a}
          modified={b}
          height={"60vh"}
        />
      )}
    </div>
  )
}


