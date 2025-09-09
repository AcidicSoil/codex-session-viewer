// Minimal stubs to keep type-checking happy if optional deps are not installed locally.
declare module '@monaco-editor/react' {
  import * as React from 'react'
  export interface DiffEditorProps {
    original?: string
    modified?: string
    language?: string
    height?: string | number
    theme?: string
    options?: any
  }
  export const DiffEditor: React.ComponentType<DiffEditorProps>
  const Editor: any
  export default Editor
}

