import { type I18n, setupI18n } from '@lingui/core'
import { i18n as marker } from '@proteus/utils'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { messages as en } from '../../locales/en.js'
import { messages as es } from '../../locales/es.js'
import { shortText } from '../bounded.js'
import { translateIssue, zodLocaleFor } from '../i18n.js'
import { StoreLoginBody } from '../store/auth/payloads.js'

/** One instance per request, as the store and the backend build them — never a shared one. */
function requestI18n(language: 'en' | 'es'): I18n {
  return setupI18n({ locale: language, messages: { [language]: language === 'es' ? es : en } })
}

function messagesIn(language: 'en' | 'es', issues: z.core.$ZodIssue[], value?: unknown) {
  const i18n = requestI18n(language)
  return issues.map((issue) => translateIssue(issue, (id, values) => i18n._(id, values), zodLocaleFor(language), value))
}

function issuesOf(schema: z.ZodType, value: unknown) {
  const result = schema.safeParse(value)
  if (result.success) throw new Error('expected the parse to fail')
  return result.error.issues
}

describe('translateIssue', () => {
  it('translates a catalog message', () => {
    const issues = issuesOf(StoreLoginBody, { email: 'shopper@example.com', password: '' })

    expect(messagesIn('es', issues)).toEqual(['Ingresa tu contraseña'])
    expect(messagesIn('en', issues)).toEqual(['Enter your password'])
  })

  it('fills a placeholder from the issue', () => {
    const issues = issuesOf(shortText, 'x'.repeat(256))

    expect(messagesIn('es', issues)).toEqual(['Usa 255 caracteres o menos'])
    expect(messagesIn('en', issues)).toEqual(['Use 255 characters or fewer'])
  })

  it("re-renders Zod's own default in the request's language", () => {
    const value = { quantity: 'two' }
    const issues = issuesOf(z.object({ quantity: z.number() }), value)

    expect(messagesIn('en', issues, value)).toEqual([issues[0]?.message])
    expect(messagesIn('es', issues, value)).toEqual(['Entrada inválida: se esperaba número, recibido texto'])
  })

  it('falls back to English for a language Zod ships no locale for', () => {
    expect(zodLocaleFor('xx').localeError).toBeTypeOf('function')
  })

  it('translates concurrent parses of one schema instance independently', async () => {
    const schema = z.object({ note: z.string().max(3, marker.t('Use {maximum} characters or fewer')) })
    const render = async (language: 'en' | 'es') => {
      const i18n = requestI18n(language)
      const result = await schema.safeParseAsync({ note: 'too long' })
      // A request that pauses between parse and render must still render its own language.
      await new Promise((resolve) => setTimeout(resolve, language === 'es' ? 10 : 0))
      if (result.success) throw new Error('expected the parse to fail')
      return result.error.issues.map((issue) =>
        translateIssue(issue, (id, values) => i18n._(id, values), zodLocaleFor(language)),
      )
    }

    const [spanish, english, spanishAgain] = await Promise.all([render('es'), render('en'), render('es')])

    expect(spanish).toEqual(['Usa 3 caracteres o menos'])
    expect(english).toEqual(['Use 3 characters or fewer'])
    expect(spanishAgain).toEqual(spanish)
  })
})
