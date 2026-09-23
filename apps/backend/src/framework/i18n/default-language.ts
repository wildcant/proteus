import type { AppContainer } from '../../core/types/container.js'
import type { Logger } from '../../core/types/logger.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { languageOf, SOURCE_LANGUAGE } from './lingui-translator.js'

/** How long the default market's language is trusted. A merchant moves the default, not a request. */
const FRESH_TTL_MS = 5 * 60 * 1000

/** How long to wait before retrying a failed read. Shorter, so a blip does not stick for minutes. */
const RETRY_TTL_MS = 30 * 1000

export type DefaultLanguage = {
  /**
   * The cached language, synchronously, so `errorHandler` stays synchronous. A stale or missing
   * entry starts a refresh and is answered from what is held meanwhile — English on a cold instance.
   */
  get(): string
}

/**
 * The language of the default market — the market behind `store.defaultRegionId` — which answers a
 * request with no `x-proteus-locale`, or one naming a language without a catalog. Cached per server
 * instance with a TTL, the same shape as the store's `api/sellable-markets.ts`; `inFlight` collapses
 * the requests that arrive together into one read.
 */
export function createDefaultLanguage({
  load,
  logger,
  now = Date.now,
}: {
  /** The default market's Locale, `es-CO` say, or null when the store names none. */
  load: () => Promise<string | null>
  logger: Logger
  now?: () => number
}): DefaultLanguage & { refresh(): Promise<void> } {
  let language: string | undefined
  let expiresAt = 0
  let inFlight: Promise<void> | undefined

  const refresh = () => {
    inFlight ??= load()
      .then((locale) => {
        language = locale ? languageOf(locale) : undefined
        expiresAt = now() + FRESH_TTL_MS
      })
      .catch((error: unknown) => {
        // Keep what is held: a failed read is not a reason to change the language.
        logger.warn(`default market language unavailable: ${error instanceof Error ? error.message : String(error)}`)
        expiresAt = now() + RETRY_TTL_MS
      })
      .finally(() => {
        inFlight = undefined
      })
    return inFlight
  }

  return {
    get() {
      if (now() >= expiresAt) void refresh()
      return language ?? SOURCE_LANGUAGE
    },
    refresh,
  }
}

/** Reads the default market's Locale through the store and region modules. */
export async function loadDefaultMarketLocale(container: AppContainer): Promise<string | null> {
  const scope = container.createScope()
  const store = await scope.resolve(Modules.STORE).resolveStore()
  if (!store?.defaultRegionId) return null
  const market = await scope.resolve(Modules.REGION).retrieveRegionMarket(store.defaultRegionId)
  return market?.localeCode ?? null
}
