/**
 * The languages the admin has a Message Catalog for. Mirrors `locales` in `lingui.config.ts`; the
 * first is Lingui's `sourceLocale`, the one that renders when nothing else has a catalog.
 */
const CATALOG_LANGUAGES = ['en', 'es'] as const
export type CatalogLanguage = (typeof CATALOG_LANGUAGES)[number]

/** The Locale a staff member starts in, and the one the picker always offers. */
export const SOURCE_LOCALE = 'en-US'

const LOCALE_KEY = 'proteus_admin_locale'

function isCatalogLanguage(language: string): language is CatalogLanguage {
  return (CATALOG_LANGUAGES as ReadonlyArray<string>).includes(language)
}

/**
 * `es-CO` → `es`. The catalog key, never the formatting tag: `Intl` and the backend get the full
 * Locale, so a staff member on `es-MX` reads the same Spanish with Mexican dates.
 */
export function catalogLanguageFor(locale: string): CatalogLanguage {
  const language = locale.split('-')[0]?.toLowerCase() ?? ''
  return isCatalogLanguage(language) ? language : CATALOG_LANGUAGES[0]
}

/**
 * The Locale the admin renders in: the signed-in staff member's own, remembered from their last
 * `/admin/users/me`; before sign-in, the browser's language; `en-US` when the browser names none.
 */
export function resolveLocale({ saved, browser }: { saved: string | null; browser: ReadonlyArray<string> }): string {
  return saved ?? browser[0] ?? SOURCE_LOCALE
}

/** The Locale this page load renders in and sends as `x-proteus-locale`. */
export function activeLocale(): string {
  return resolveLocale({ saved: localStorage.getItem(LOCALE_KEY), browser: navigator.languages })
}

/**
 * Remembers the staff member's Locale for the next page load. `true` when it differs from the one
 * this page rendered in: the catalog is loaded once, before the router, so a change of language is a
 * reload.
 */
export function rememberLocale(locale: string): boolean {
  const changed = activeLocale() !== locale
  localStorage.setItem(LOCALE_KEY, locale)
  return changed
}

/** Signing out hands the sign-in page back to the browser's language. */
export function forgetLocale(): void {
  localStorage.removeItem(LOCALE_KEY)
}
