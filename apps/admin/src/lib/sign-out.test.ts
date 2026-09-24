import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { getToken, setToken } from './auth-token'
import { activeLocale, rememberLocale } from './i18n/locale'
import { signOut } from './sign-out'

/** An English browser holding a Spanish staff member's session. */
function spanishSessionInEnglishBrowser() {
  const store = new Map<string, string>()
  vi.stubGlobal('navigator', { languages: ['en-US'] })
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  })
  const location = { href: '/products' }
  vi.stubGlobal('window', { location })
  setToken('token')
  rememberLocale('es-CO')
  return location
}

let location: { href: string }
beforeEach(() => {
  location = spanishSessionInEnglishBrowser()
})
afterEach(() => vi.unstubAllGlobals())

describe('signOut', () => {
  test('boots a fresh login page in the browser language', () => {
    signOut()
    expect(getToken()).toBeNull()
    expect(activeLocale()).toBe('en-US')
    expect(location.href).toBe('/login')
  })
})
