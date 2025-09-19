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

declare module 'diff' {
  export function createTwoFilesPatch(
    oldFileName: string,
    newFileName: string,
    oldStr: string,
    newStr: string,
    oldHeader?: string,
    newHeader?: string,
    options?: { context?: number }
  ): string
}

declare module 'diff2html' {
  export function html(diff: string, options?: Record<string, unknown>): string
}

