import React, { useRef } from 'react'
import { Button } from './ui/button'

export interface FileInputButtonProps {
  onFile: (file: File) => void
  accept?: string
  label?: string
  disabled?: boolean
  className?: string
}

export function FileInputButton({
  onFile,
  accept = '.jsonl,.txt',
  label = 'Choose .jsonl file',
  disabled,
  className,
}: FileInputButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  function trigger() {
    inputRef.current?.click()
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFile(file)
    // Reset value so selecting the same file again still fires change
    e.target.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        className="hidden"
        aria-hidden
      />
      <Button type="button" onClick={trigger} disabled={disabled} className={className}>
        {label}
      </Button>
    </>
  )
}

export default FileInputButton
