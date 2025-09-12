import * as React from 'react'
import DiffViewer from './DiffViewer'

export default function TwoFileDiff() {
  const [a, setA] = React.useState<string>('')
  const [b, setB] = React.useState<string>('')
  const [nameA, setNameA] = React.useState<string>('')
  const [nameB, setNameB] = React.useState<string>('')

  async function onPick(which: 'a'|'b', file?: File) {
    if (!file) return
    const text = await file.text()
    if (which === 'a') { setA(text); setNameA(file.name) }
    else { setB(text); setNameB(file.name) }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600">Compare any two local files by selecting them below.</div>
      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm">File A
          <input type="file" className="ml-2" onChange={(e) => onPick('a', e.target.files?.[0] || undefined)} />
        </label>
        <label className="text-sm">File B
          <input type="file" className="ml-2" onChange={(e) => onPick('b', e.target.files?.[0] || undefined)} />
        </label>
      </div>
      {(a !== '' || b !== '') && (
        <DiffViewer
          path={nameB || nameA || 'untitled'}
          original={a}
          modified={b}
          height={"60vh"}
        />
      )}
    </div>
  )
}

