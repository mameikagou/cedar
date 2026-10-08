import { useLayoutEffect } from 'react'
import { useThemeStore } from '@/stores/useThemeStore'
export function useTheme() {
  const theme = useThemeStore((state) => state.theme)
  const toggle = useThemeStore((state) => state.toggle)
  useLayoutEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark') }, [theme])
  return { theme, toggle }
}
