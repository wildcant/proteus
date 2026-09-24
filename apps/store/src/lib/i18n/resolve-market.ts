import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import {
  DEFAULT_MARKET,
  looksLikeMarketSegment,
  type Market,
  type SellableMarkets,
  splitMarketSegment,
} from '#/lib/market'

/**
 * The languages the store has a Message Catalog for. Mirrors `locales` in `lingui.config.ts`; the
 * first is Lingui's `sourceLocale`, the one that renders when nothing else has a catalog.
 */
const CATALOG_LANGUAGES = ['en', 'es'] as const
export type CatalogLanguage = (typeof CATALOG_LANGUAGES)[number]

/**
 * The URL this render is for, on either side: the request on the server, the address bar on the
 * client.
 *
 * `getRouter()` reads it because it has to pick a catalog before the router exists — the rewrite
 * that discovers the market only runs once Start attaches the request's history, after
 * `getRouter()` has returned. Both sides parse it with the rewrite's own `splitMarketSegment`, so
 * the server's language and the one the client hydrates in cannot disagree.
 */
export const currentUrl = createIsomorphicFn()
  .server(() => new URL(getRequest().url))
  .client(() => new URL(window.location.href))

/** The market a pathname is in: its segment when the store sells there, the default otherwise. */
export function resolveMarket(pathname: string, sellable: SellableMarkets): Market {
  return splitMarketSegment(pathname, sellable.markets)?.market ?? sellable.defaultMarket
}

function isCatalogLanguage(language: string): language is CatalogLanguage {
  return (CATALOG_LANGUAGES as ReadonlyArray<string>).includes(language)
}

/** `es-CO` → `es`. The catalog key, never the formatting tag: `Intl` gets the full locale code. */
function languageOf(market: Market): string {
  return market.localeCode.split('-')[0]?.toLowerCase() ?? ''
}

/**
 * The catalog a market renders in: its own language, else the default market's, else the source
 * language. The default market is admin-configured, so the fallback language is too; the market
 * still formats numbers and dates in its own locale code.
 */
export function catalogLanguageFor(market: Market, defaultMarket: Market): CatalogLanguage {
  for (const language of [languageOf(market), languageOf(defaultMarket)]) {
    if (isCatalogLanguage(language)) return language
  }
  return CATALOG_LANGUAGES[0]
}

/**
 * The `x-proteus-locale` value for a pathname: its market segment, else the compiled-in default.
 *
 * The segment rather than a resolved market because the fetcher sits beneath the sellable-markets
 * read — resolving against that set here would import it back into its own request path. A segment
 * the store does not sell in only reaches a not-found page, and the backend falls back on any
 * locale it has no catalog for.
 */
export function requestLocaleCodeFor(pathname: string): string {
  if (!looksLikeMarketSegment(pathname)) return DEFAULT_MARKET.localeCode
  return pathname.split('/')[1] ?? DEFAULT_MARKET.localeCode
}
