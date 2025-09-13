import { describe, it, expect } from 'vitest'
import { usePreferences } from '../preferences'

describe('preferences store', () => {
  it('toggles chat mode', () => {
    expect(usePreferences.getState().chatMode).toBe(false)
    usePreferences.getState().setChatMode(true)
    expect(usePreferences.getState().chatMode).toBe(true)
    usePreferences.getState().setChatMode(false)
  })
})

