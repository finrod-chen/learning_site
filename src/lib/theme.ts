import { useCallback, useEffect, useState } from 'react'
import type { Theme } from '@/components/arc/theme-switch/theme-switch'

const KEY = 'jn:theme'

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* ignore */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111111' : '#ffffff')
    window.dispatchEvent(new Event('jn-theme'))
  }, [theme])
  const set = useCallback((t: Theme) => {
    setTheme(t)
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* ignore */
    }
  }, [])
  return [theme, set] as const
}
