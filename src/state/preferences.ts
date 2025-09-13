import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PreferencesState {
  chatMode: boolean
  setChatMode: (v: boolean) => void
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      chatMode: false,
      setChatMode: (chatMode) => set({ chatMode })
    }),
    { name: 'csv:preferences' }
  )
)

