/**
 * The languages the admin has a Message Catalog for. Mirrors `locales` in `lingui.config.ts`; the
 * first is Lingui's `sourceLocale`, the one that renders when nothing else has a catalog.
 */
const CATALOG_LANGUAGES = ['en', 'es'] as const
export type CatalogLanguage = (typeof CATALOG_LANGUAGES)[number]

/** The Locale a staff member starts in, and the one the picker always offers. */
const SOURCE_LOCALE = 'en-US'

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
 * `locale` when the admin has a catalog for its language, else `en-US`. A `fr-FR` page would
 * render English while declaring `lang="fr-FR"` and formatting French dates.
 */
function supportedLocale(locale: string): string {
  const language = locale.split('-')[0]?.toLowerCase() ?? ''
  return isCatalogLanguage(language) ? locale : SOURCE_LOCALE
}

/**
 * The Locale this page load renders in and sends as `x-proteus-locale`: the signed-in staff
 * member's own, remembered from their last `/admin/users/me`; before sign-in, the browser's
 * language; `en-US` when the browser names none, or one the admin has no catalog for.
 */
export function activeLocale(): string {
  return supportedLocale(localStorage.getItem(LOCALE_KEY) ?? navigator.languages[0] ?? SOURCE_LOCALE)
}

/**
 * Remembers the staff member's Locale for the next page load. `true` when it differs from the one
 * this page rendered in: the catalog is loaded once, before the router, so a change of language is a
 * reload.
 */
export function rememberLocale(locale: string): boolean {
  const supported = supportedLocale(locale)
  const changed = activeLocale() !== supported
  localStorage.setItem(LOCALE_KEY, supported)
  return changed
}

/** Signing out hands the sign-in page back to the browser's language. */
export function forgetLocale(): void {
  localStorage.removeItem(LOCALE_KEY)
}

/**
 * The Locale dates are formatted in, or `undefined` for the English admin, where `@proteus/utils`
 * keeps its fixed `MMM d, yyyy` pattern. `Intl` would render English dates differently, and English
 * must render as it always has.
 */
export function dateLocale(): string | undefined {
  const locale = activeLocale()
  return catalogLanguageFor(locale) === 'en' ? undefined : locale
}
