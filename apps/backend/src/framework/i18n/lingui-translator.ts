import { type Messages, setupI18n } from '@lingui/core'
import { translateIssue, zodLocaleFor } from '@proteus/http-schemas/i18n'
import { messages as schemasEn } from '@proteus/http-schemas/locales/en'
import { messages as schemasEs } from '@proteus/http-schemas/locales/es'
import { messages as backendEn } from '../../../locales/en.js'
import { messages as backendEs } from '../../../locales/es.js'
import type { Translator } from '../../core/i18n/types.js'

/** The request header that names the shopper's Locale, `es-CO` say. */
export const LOCALE_HEADER = 'x-proteus-locale'

/** The source language, and the last resort when neither the request nor the default market has a catalog. */
export const SOURCE_LANGUAGE = 'en'

/**
 * One catalog per language: the backend's own messages plus `@proteus/http-schemas`', since a
 * validation message thrown by a route comes from the shared schemas. The compiled `.ts` catalogs
 * are committed, because neither tsx nor a Worker can import a `.po` at runtime.
 */
const catalogs: Record<string, Messages> = {
  en: { ...schemasEn, ...backendEn },
  es: { ...schemasEs, ...backendEs },
}

/** `es` for `es-CO`; the Locale's language is all a catalog is keyed by. */
export function languageOf(locale: string): string {
  return locale.split('-')[0]?.trim().toLowerCase() ?? ''
}

/**
 * The catalog language a request is answered in: the header's, when there is a catalog for it;
 * otherwise `fallbackLanguage` (the default market's); otherwise English.
 */
function resolveLanguage(locale: string | undefined, fallbackLanguage: string): string {
  const requested = locale ? languageOf(locale) : ''
  if (Object.hasOwn(catalogs, requested)) return requested
  const fallback = languageOf(fallbackLanguage)
  return Object.hasOwn(catalogs, fallback) ? fallback : SOURCE_LANGUAGE
}

/**
 * A fresh Lingui instance per call, never a shared global one: requests interleave on one server
 * instance, and a global `i18n.activate()` would bleed one request's language into another's.
 */
export function createLinguiTranslator(locale: string | undefined, fallbackLanguage: string): Translator {
  const language = resolveLanguage(locale, fallbackLanguage)
  const i18n = setupI18n({ locale: language, messages: { [language]: catalogs[language] ?? {} } })
  const translate: Translator['translate'] = (message, values) => i18n._(message, values)
  const zodLocale = zodLocaleFor(language)
  return { locale: language, translate, translateIssue: (issue) => translateIssue(issue, translate, zodLocale) }
}
