import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { getToken, setToken } from '#/lib/auth-token'
import { activeLocale, rememberLocale } from '#/lib/i18n/locale'

vi.mock('#/env', () => ({ env: { VITE_BACKEND_URL: 'http://backend.test' } }))

const { fetcher } = await import('./fetcher')

let location: { href: string }
beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('navigator', { languages: ['en-US'] })
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  })
  location = { href: '/products' }
  vi.stubGlobal('window', { location })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })),
  )
  setToken('expired')
  rememberLocale('es-CO')
})
afterEach(() => vi.unstubAllGlobals())

describe('fetcher on a 401', () => {
  test('signs the staff member out to a login page in the browser language', async () => {
    await expect(fetcher({ url: '/admin/products', method: 'GET' })).rejects.toThrow('Unauthorized')
    expect(getToken()).toBeNull()
    expect(activeLocale()).toBe('en-US')
    expect(location.href).toBe('/login')
  })

  test('a failed sign-in keeps the page where it is', async () => {
    await expect(fetcher({ url: '/auth/user/emailpass', method: 'POST', data: {} })).rejects.toThrow()
    expect(location.href).toBe('/products')
    expect(activeLocale()).toBe('es-CO')
  })
})
