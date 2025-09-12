import * as React from 'react'
import { Clipboard } from './clipboard'
import { Button } from './button'

export interface ClipboardButtonProps {
  value: string | (() => string)
  label?: string
  copiedLabel?: string
  timeout?: number
  className?: string
}

export function ClipboardButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  timeout = 2000,
  className,
}: ClipboardButtonProps) {
  const getValue = React.useCallback(() => (typeof value === 'function' ? (value as () => string)() : value), [value])
  return (
    <Clipboard.Root value={getValue()} timeout={timeout} onCopy={(e) => {
      // Fallback if clipboard API unavailable is handled by Ark UI
      // We could add toast here if needed
    }}>
      <Clipboard.Trigger asChild>
        <Button type="button" variant="outline" size="sm" className={className} aria-label={label}>
          <Clipboard.Indicator copied className="inline">{copiedLabel}</Clipboard.Indicator>
          <Clipboard.Indicator className="inline">{label}</Clipboard.Indicator>
        </Button>
      </Clipboard.Trigger>
    </Clipboard.Root>
  )
}

export default ClipboardButton
