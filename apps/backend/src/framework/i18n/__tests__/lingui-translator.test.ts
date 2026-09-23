import type { Msgid } from '@proteus/utils'
import { noopTranslator } from '@tests/setup/noop-translator.js'
import { describe, expect, it } from 'vitest'
import { createLinguiTranslator } from '../lingui-translator.js'

// Cast, not `i18n.t()`: the extractor scans tests too, and these ids belong to the catalogs already.
const tooLong = 'Use {maximum} characters or fewer' as Msgid
const internal = 'An internal error occurred' as Msgid

describe('createLinguiTranslator', () => {
  it('translates into the header language, from both the backend and the schemas catalogs', () => {
    const translator = createLinguiTranslator('es-CO', 'en')

    expect(translator.locale).toBe('es')
    expect(translator.translate(internal)).toBe('Ocurrió un error interno')
    expect(translator.translate(tooLong, { maximum: 80 })).toBe('Usa 80 caracteres o menos')
  })

  it('answers in the fallback language when there is no header or no catalog for it', () => {
    expect(createLinguiTranslator(undefined, 'es-CO').translate(internal)).toBe('Ocurrió un error interno')
    expect(createLinguiTranslator('fr-FR', 'es').translate(internal)).toBe('Ocurrió un error interno')
  })

  it('answers in English when the fallback has no catalog either', () => {
    expect(createLinguiTranslator('fr-FR', 'de').translate(tooLong, { maximum: 3 })).toBe('Use 3 characters or fewer')
  })

  it('returns a message missing from every catalog as written', () => {
    expect(createLinguiTranslator('es-CO', 'en').translate('Not catalogued' as Msgid)).toBe('Not catalogued')
  })

  it('keeps each translator in its own language when they interleave', async () => {
    const answers = await Promise.all(
      ['es-CO', 'en-US', 'es-MX', 'fr-FR'].map(async (locale) => {
        const translator = createLinguiTranslator(locale, 'en')
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5))
        return translator.translate(internal)
      }),
    )

    expect(answers).toEqual([
      'Ocurrió un error interno',
      'An internal error occurred',
      'Ocurrió un error interno',
      'An internal error occurred',
    ])
  })
})

describe('the resolved language', () => {
  it('is read off the Locale case-insensitively, and an empty header falls back', () => {
    expect(createLinguiTranslator('ES-co', 'en').locale).toBe('es')
    expect(createLinguiTranslator('', 'es').locale).toBe('es')
  })
})

describe('noopTranslator', () => {
  it('fills the values into the English message', () => {
    expect(noopTranslator.translate(tooLong, { maximum: 5 })).toBe('Use 5 characters or fewer')
  })
})
