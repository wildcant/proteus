import type { CountryMarketDTO } from '@core/types/region/common.js'

/** Offered even when no market sells in it: the admin's source language is always available. */
const SOURCE_LOCALE = 'en-US'

/**
 * The Locales a staff member can pick for the admin, from the sellable markets: each market's,
 * `en-US` first. The admin loads its catalog from the language subtag, so `es-CO` and `es-MX` both
 * render Spanish.
 */
export function adminLocales(sellableMarkets: CountryMarketDTO[]): string[] {
  const sold = sellableMarkets.flatMap((market) => (market.localeCode ? [market.localeCode] : []))
  return [...new Set([SOURCE_LOCALE, ...sold])]
}
