import { type Messages, setupI18n } from '@lingui/core'
import { translateIssue, zodLocaleFor } from '@proteus/http-schemas/i18n'
import { messages as schemasEn } from '@proteus/http-schemas/locales/en'
import { messages as schemasEs } from '@proteus/http-schemas/locales/es'
import { messages as backendEn } from '../../../locales/en.js'
import { messages as backendEs } from '../../../locales/es.js'
import type { Translator } from '../../core/i18n/types.js'
import { extensionRegistry } from '../../extensions/registry.gen.js'
import type { ExtensionRegistry } from '../extensions/types.js'

/** The request header that names the shopper's Locale, `es-CO` say. */
export const LOCALE_HEADER = 'x-proteus-locale'

/** The source language, and the last resort when neither the request nor the default market has a catalog. */
export const SOURCE_LANGUAGE = 'en'

/** One merged catalog per language, keyed by catalog language (`en`, `es`). */
export type Catalogs = Record<string, Messages>

/**
 * Core's catalogs: the backend's own messages plus `@proteus/http-schemas`', since a validation
 * message thrown by a route comes from the shared schemas. The compiled `.ts` catalogs are committed,
 * because neither tsx nor a Worker can import a `.po` at runtime.
 */
const coreCatalogs: Catalogs = {
  en: { ...schemasEn, ...backendEn },
  es: { ...schemasEs, ...backendEs },
}

function compareNames(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * Core's catalogs with each extension's merged after them, in extension-name order, so a request
 * translates an extension's messages, and its schemas' validation messages, like core's. Only core's
 * languages: a language core has no catalog for is not one a request can be answered in. A message
 * two catalogs translate differently fails the extension generator, so the order decides nothing a
 * fork can see; it is fixed so that it never depends on how the registry was written.
 *
 * @testSeam Production merges once, from the generated registry, just below. The export is for the
 * translator test and the test API, which merge the fixture extension's catalogs instead.
 */
export function mergeCatalogs(extensionCatalogs: ExtensionRegistry['catalogs']): Catalogs {
  // Stable, so an extension's two catalogs (its schemas' then its own) keep the registry's order.
  const ordered = [...extensionCatalogs].sort((a, b) => compareNames(a.extension, b.extension))
  return Object.fromEntries(
    Object.entries(coreCatalogs).map(([language, core]) => [
      language,
      Object.assign({}, core, ...ordered.map(({ messages }) => messages[language] ?? {})),
    ]),
  )
}

/** What the composition roots translate with: core's and the generated registry's extensions'. */
const defaultCatalogs = mergeCatalogs(extensionRegistry.catalogs)

/** `es` for `es-CO`; the Locale's language is all a catalog is keyed by. */
export function languageOf(locale: string): string {
  return locale.split('-')[0]?.trim().toLowerCase() ?? ''
}

/**
 * The catalog language a request is answered in: the header's, when there is a catalog for it;
 * otherwise `fallbackLanguage` (the default market's); otherwise English.
 *
 * `fallbackLanguage` is only read when the header names no catalog: on a cold instance it waits on
 * the default market lookup, and a request that names its own language must not wait on that.
 */
async function resolveLanguage(
  catalogs: Catalogs,
  locale: string | undefined,
  fallbackLanguage: () => Promise<string>,
): Promise<string> {
  const requested = locale ? languageOf(locale) : ''
  if (Object.hasOwn(catalogs, requested)) return requested
  const fallback = languageOf(await fallbackLanguage())
  return Object.hasOwn(catalogs, fallback) ? fallback : SOURCE_LANGUAGE
}

/**
 * A fresh Lingui instance per call, never a shared global one: requests interleave on one server
 * instance, and a global `i18n.activate()` would bleed one request's language into another's.
 *
 * `catalogs` is `mergeCatalogs` of a registry's; the default is the generated registry's, and a test
 * passes the fixture registry's.
 */
export async function createLinguiTranslator(
  locale: string | undefined,
  fallbackLanguage: () => Promise<string>,
  catalogs: Catalogs = defaultCatalogs,
): Promise<Translator> {
  const language = await resolveLanguage(catalogs, locale, fallbackLanguage)
  const messages = catalogs[language] ?? {}
  const i18n = setupI18n({ locale: language, messages: { [language]: messages } })
  const translate: Translator['translate'] = (message, values) => i18n._(message, values)
  const zodLocale = zodLocaleFor(language)
  return {
    locale: language,
    translate,
    // The merged catalog decides which issue messages are ours, so an extension schema's is translated.
    translateIssue: (issue) => translateIssue(issue, translate, zodLocale, undefined, messages),
  }
}
