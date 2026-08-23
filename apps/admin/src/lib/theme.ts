export type ThemeMode = 'light' | 'dark' | 'auto'

const STORAGE_KEY = 'theme'

export function getStoredThemeMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'auto') {
    return stored
  }

  return 'auto'
}

export function storeThemeMode(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode)
}

export function applyThemeMode(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode
  const root = document.documentElement

  // The class drives Tailwind's `dark` variant; `data-theme` records the choice the user made,
  // which is not recoverable from the class once `auto` resolves.
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)

  if (mode === 'auto') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', mode)
  }

  root.style.colorScheme = resolved
}
