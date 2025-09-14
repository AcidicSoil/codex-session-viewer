/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ThemePicker from '../ThemePicker'
import { useTheme } from '../../state/theme'

// Ensure DOM styles don't leak between tests
beforeEach(() => {
  document.documentElement.removeAttribute('style')
})

afterEach(() => {
  cleanup()
})

describe('ThemePicker', () => {
  it('applies and resets custom primary color', () => {
    const root = document.documentElement
    render(<ThemePicker />)
    const hexInput = screen.getByLabelText('Primary color hex')
    fireEvent.change(hexInput, { target: { value: 'ff0000' } })
    expect(root.style.getPropertyValue('--primary').trim()).toBe('255 0 0')
    fireEvent.click(screen.getByTitle('Reset to theme defaults'))
    expect(root.style.getPropertyValue('--primary')).toBe('')
    expect(useTheme.getState().theme).toBe('teal')
  })

  it('resets custom background color', () => {
    const root = document.documentElement
    render(<ThemePicker />)
    const bgInput = screen.getByLabelText('Background color hex')
    fireEvent.change(bgInput, { target: { value: '0000ff' } })
    expect(root.style.getPropertyValue('--background').trim()).toBe('0 0 255')
    fireEvent.click(screen.getByTitle('Reset background'))
    expect(root.style.getPropertyValue('--background')).toBe('')
  })

  it('changes theme via select', () => {
    const root = document.documentElement
    render(<ThemePicker />)
    const select = screen.getByLabelText('Theme select')
    fireEvent.change(select, { target: { value: 'rose' } })
    expect(root.getAttribute('data-theme')).toBe('rose')
    const hexInput = screen.getByLabelText('Primary color hex') as HTMLInputElement
    expect(hexInput.value).toBe('f43f5e')
  })
})
