import { describe, expect, test } from 'vitest'
import { catalogLanguageFor, resolveLocale } from './locale'

describe('resolveLocale', () => {
  test('a signed-in staff member renders in their own Locale, whatever the browser says', () => {
    expect(resolveLocale({ saved: 'es-CO', browser: ['en-GB'] })).toBe('es-CO')
  })

  test('before sign-in the browser language decides', () => {
    expect(resolveLocale({ saved: null, browser: ['es-419', 'en'] })).toBe('es-419')
  })

  test('a browser that names no language renders en-US', () => {
    expect(resolveLocale({ saved: null, browser: [] })).toBe('en-US')
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
