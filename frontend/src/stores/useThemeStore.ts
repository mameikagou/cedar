/** UI state only; server data stays in TanStack Query. */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
type Theme = 'light' | 'dark'
export const useThemeStore = create<{ theme: Theme; toggle: () => void }>()(
  persist(
    (set) => ({ theme: 'light', toggle: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })) }),
    { name: 'cedar-theme', partialize: (state) => ({ theme: state.theme }) },
  ),
)
