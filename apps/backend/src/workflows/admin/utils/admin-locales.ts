import type { CountryMarketDTO } from '@core/types/region/common.js'

/** Offered even when no market sells in it: the admin's source language is always available. */
const SOURCE_LOCALE = 'en-US'

/**
 * The languages the admin ships a Message Catalog for. Mirrors `locales` in
 * `apps/admin/lingui.config.ts`: a Locale in any other language would render English while the page
 * declares that Locale.
 */
const ADMIN_CATALOG_LANGUAGES: ReadonlyArray<string> = ['en', 'es']

function hasAdminCatalog(locale: string): boolean {
  return ADMIN_CATALOG_LANGUAGES.includes(locale.split('-')[0]?.toLowerCase() ?? '')
}

/**
 * The Locales a staff member can pick for the admin, from the sellable markets: each market's the
 * admin has a catalog for, `en-US` first. The admin loads its catalog from the language subtag, so
 * `es-CO` and `es-MX` both render Spanish; a `fr-FR` market is not offered.
 */
export function adminLocales(sellableMarkets: CountryMarketDTO[]): string[] {
  const sold = sellableMarkets.flatMap((market) =>
    market.localeCode && hasAdminCatalog(market.localeCode) ? [market.localeCode] : [],
  )
  return [...new Set([SOURCE_LOCALE, ...sold])]
}
