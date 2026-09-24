import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { activeLocale, catalogLanguageFor, dateLocale, forgetLocale, rememberLocale } from './locale'

/** A browser naming `languages`, with an empty `localStorage`. */
function browserSpeaking(...languages: string[]) {
  const store = new Map<string, string>()
  vi.stubGlobal('navigator', { languages })
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  })
}

beforeEach(() => browserSpeaking('en-GB'))
afterEach(() => vi.unstubAllGlobals())

describe('activeLocale', () => {
  test('before sign-in the browser language decides', () => {
    browserSpeaking('es-419', 'en')
    expect(activeLocale()).toBe('es-419')
  })

  test('a browser that names no language renders en-US', () => {
    browserSpeaking()
    expect(activeLocale()).toBe('en-US')
  })

  test('a signed-in staff member renders in their own Locale, whatever the browser says', () => {
    rememberLocale('es-CO')
    expect(activeLocale()).toBe('es-CO')
  })

  test('signing out hands the page back to the browser language', () => {
    rememberLocale('es-CO')
    forgetLocale()
    expect(activeLocale()).toBe('en-GB')
  })
})

describe('rememberLocale', () => {
  test('asks for a reload only when the Locale differs from the one this page rendered in', () => {
    expect(rememberLocale('es-CO')).toBe(true)
    expect(rememberLocale('es-CO')).toBe(false)
  })
})

describe('catalogLanguageFor', () => {
  test('the language subtag of the Locale names the catalog', () => {
    expect(catalogLanguageFor('es-CO')).toBe('es')
    expect(catalogLanguageFor('es')).toBe('es')
    expect(catalogLanguageFor('en-US')).toBe('en')
  })

  test('a language with no catalog renders the source language', () => {
    expect(catalogLanguageFor('fr-FR')).toBe('en')
    expect(catalogLanguageFor('')).toBe('en')
  })
})

describe('dateLocale', () => {
  test('English keeps the fixed date pattern; any other language formats in its Locale', () => {
    expect(dateLocale()).toBeUndefined()
    rememberLocale('es-CO')
    expect(dateLocale()).toBe('es-CO')
  })
})
