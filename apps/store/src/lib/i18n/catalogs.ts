import { type I18n, type Messages, setupI18n } from '@lingui/core'
import type { CatalogLanguage } from './resolve-market'

/**
 * One loader per language, so each language is its own chunk and a page fetches only its own.
 * The shared schemas' catalog is merged under the store's: validation messages are translated at
 * display, by the same instance that renders the form.
 */
const loaders: Record<CatalogLanguage, () => Promise<[{ messages: Messages }, { messages: Messages }]>> = {
  en: () => Promise.all([import('@proteus/http-schemas/locales/en'), import('../../locales/en.po')]),
  es: () => Promise.all([import('@proteus/http-schemas/locales/es'), import('../../locales/es.po')]),
}

/**
 * A fresh, activated instance for one router. Never a singleton: one isolate serves many requests
 * at once, and a shared instance activated by an `/en-US` request would switch a paused `/es-CO`
 * render to English.
 */
export async function createI18n(language: CatalogLanguage): Promise<I18n> {
  const [schemas, store] = await loaders[language]()
  return setupI18n({ locale: language, messages: { [language]: { ...schemas.messages, ...store.messages } } })
}
