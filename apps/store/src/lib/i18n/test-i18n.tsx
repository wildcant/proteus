import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactNode } from 'react'
import { messages as esMessages } from '#/locales/es.po'

// The source language with an empty catalog: in a component test the macros carry their English,
// so every message renders exactly as written and assertions stay in English.
const i18n = setupI18n({ locale: 'en', messages: { en: {} } })

// The Spanish catalog as the es-CO market loads it, for the tests whose subject is the translation.
const spanish = setupI18n({ locale: 'es', messages: { es: esMessages } })

/**
 * The `wrapper` a component test renders through. The app gets its instance from the router's
 * `InnerWrap` (`i18n-provider.tsx`); a component rendered on its own has no router to ask, and
 * `useLingui` throws without a provider above it.
 */
export function I18nTestProvider({ children }: { children: ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

/** `I18nTestProvider` in Spanish, for asserting that a component's copy goes through the catalog. */
export function SpanishI18nTestProvider({ children }: { children: ReactNode }) {
  return <I18nProvider i18n={spanish}>{children}</I18nProvider>
}
