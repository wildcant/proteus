import { type I18n, type Messages, setupI18n } from '@lingui/core'
import type { CatalogLanguage } from './locale'

/**
 * One loader per language, so each language is its own chunk and a page fetches only its own.
 * The shared schemas' catalog is merged under the admin's: validation messages are translated at
 * display, by the same instance that renders the form.
 */
const loaders: Record<CatalogLanguage, () => Promise<[{ messages: Messages }, { messages: Messages }]>> = {
  en: () => Promise.all([import('@proteus/http-schemas/locales/en'), import('../../locales/en.po')]),
  es: () => Promise.all([import('@proteus/http-schemas/locales/es'), import('../../locales/es.po')]),
}

/**
 * The activated instance for this page load, handed to `I18nProvider` in `main.tsx`. Never Lingui's
 * global `i18n`: the same rule as the store, so one lint rule bans bare `t` in both apps.
 */
export async function createI18n(language: CatalogLanguage): Promise<I18n> {
  const [schemas, admin] = await loaders[language]()
  return setupI18n({ locale: language, messages: { [language]: { ...schemas.messages, ...admin.messages } } })
}
