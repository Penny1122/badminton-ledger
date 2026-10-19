import { useState } from 'react'

/** 深淺色主題，預設深色。index.html 會在畫面出現前先套用，鍵名要一致 */
export type Theme = 'dark' | 'light'

const KEY = 'badminton.theme'

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // 無法儲存時只在這次開啟期間有效
    }
    setTheme(next)
  }

  return { theme, toggle }
}
