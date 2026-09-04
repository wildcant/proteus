import type {
  ILinkService,
  IPaymentModuleService,
  IRegionModuleService,
  IStoreModuleService,
} from '../../src/core/types/index.js'
import { SEED_COUNTRIES } from '../fixtures/countries.js'

/**
 * The markets the store trades in, and everything that has to exist for one to be reachable:
 * regions, the ISO country table with the sellable ones opted in, the store, and which payment
 * providers each region offers.
 *
 * Extracted from the development seed because the storefront now needs markets to render at all —
 * the router reads its routable URL segments from the country endpoint — so the end-to-end
 * database has to carry them too. One definition, two callers: a market added here appears in
 * both without either being remembered.
 */

type Market = {
  name: string
  currencyCode: string
  /** `localeCode` is optional here on purpose. The check in `seedMarkets` is what enforces it, so a
   *  market missing one fails the seed naming the country rather than failing to compile. */
  countries: { iso2: string; localeCode?: string }[]
}

export const MARKETS: Market[] = [
  { name: 'United States', currencyCode: 'usd', countries: [{ iso2: 'us', localeCode: 'en-US' }] },
  { name: 'Colombia', currencyCode: 'cop', countries: [{ iso2: 'co', localeCode: 'es-CO' }] },
]

const STORE_NAME = 'Proteus'

/**
 * A price is stored in whole currency units — `amount` is a `numeric`, and `formatPrice` hands it
 * to `Intl` unscaled — so the peso price is the dollar price times the rate, with nothing to
 * convert between minor and major units. The rate is round rather than accurate: this is seed data.
 */
const COP_PER_USD = 4000

export function amountIn(currencyCode: string, usdAmount: number): number {
  if (currencyCode === 'usd') return usdAmount
  if (currencyCode === 'cop') return usdAmount * COP_PER_USD
  throw new Error(`No seed conversion for currency "${currencyCode}"`)
}

type MarketSeedServices = {
  regionService: IRegionModuleService
  storeService: IStoreModuleService
  paymentService: IPaymentModuleService
  linkService: ILinkService
}

/** Idempotent: every step skips when its table already holds rows, so a re-run is a no-op. */
export async function seedMarkets({ regionService, storeService, paymentService, linkService }: MarketSeedServices) {
  // A region owns a currency and a country belongs to at most one region, so assigning a region is
  // what makes a country sellable. Everything else here derives from this one table.
  const [primaryMarket] = MARKETS
  if (!primaryMarket) throw new Error('Expected at least one market to seed')

  const existingRegions = await regionService.listRegions()
  const regions =
    existingRegions.length > 0
      ? existingRegions
      : await regionService.createRegions(MARKETS.map(({ name, currencyCode }) => ({ name, currencyCode })))
  console.info(
    existingRegions.length > 0
      ? `Skipped regions (${existingRegions.length} already exist)`
      : `Seeded ${regions.length} regions: ${regions.map((region) => `${region.name} (${region.currencyCode})`).join(', ')}`,
  )

  const regionIdByName = new Map(regions.map((region) => [region.name, region.id]))
  const marketByIso2 = new Map(
    MARKETS.flatMap((market) =>
      market.countries.map((country) => [country.iso2, { regionName: market.name, localeCode: country.localeCode }]),
    ),
  )

  const existingCountries = await regionService.listCountries()
  if (existingCountries.length === 0) {
    await regionService.createCountries(
      SEED_COUNTRIES.map((country) => {
        const market = marketByIso2.get(country.iso2)
        return {
          id: country.iso2,
          iso3: country.iso3,
          numericCode: country.numericCode,
          name: country.name,
          displayName: country.displayName,
          regionId: market ? (regionIdByName.get(market.regionName) ?? null) : null,
          localeCode: market?.localeCode ?? null,
        }
      }),
    )
    console.info(`Seeded ${SEED_COUNTRIES.length} ISO countries, ${marketByIso2.size} of them sellable`)
  } else {
    console.info(`Skipped countries (${existingCountries.length} already exist)`)
  }

  // A sellable country with no locale has nothing to format its prices and dates with, and the
  // symptom is a page reading `COP 1,234` rather than an error. Checked against what is in the
  // database, so a re-run catches a country whose locale was removed after it was seeded.
  const withoutLocale = (await regionService.listCountries()).filter(
    (country) => country.regionId !== null && !country.localeCode,
  )
  if (withoutLocale.length > 0) {
    const named = withoutLocale.map((country) => `${country.displayName} (${country.id})`).join(', ')
    throw new Error(
      `Sellable countries with no locale code: ${named}. A country with an owning region is one the ` +
        'storefront formats money and dates for, so it needs a BCP 47 tag — add one in MARKETS.',
    )
  }

  const existingStores = await storeService.listStores()
  if (existingStores.length === 0) {
    const defaultRegionId = regionIdByName.get(primaryMarket.name)
    if (!defaultRegionId) throw new Error(`Missing region "${primaryMarket.name}" for the store's default`)

    const store = await storeService.createStore({
      name: STORE_NAME,
      defaultRegionId,
      // The first market is the default one, so its currency is the store's default too.
      currencies: MARKETS.map((market, index) => ({ currencyCode: market.currencyCode, isDefault: index === 0 })),
    })
    console.info(`Seeded store "${store.name}" defaulting to ${primaryMarket.name} (${primaryMarket.currencyCode})`)
  } else {
    console.info(`Skipped store (${existingStores.length} already exist)`)
  }

  // Many-to-many through the link module: every enabled provider serves every region for now, but
  // which providers a region offers is a per-region decision, not a column on the provider.
  const regionIds = regions.map((region) => region.id)
  const existingRegionProviders = await linkService.repo('regionPaymentProvider').findByRegionIds(regionIds)
  if (existingRegionProviders.length === 0) {
    const enabledProviders = await paymentService.listPaymentProviders({ isEnabled: true })
    const links = regionIds.flatMap((regionId) =>
      enabledProviders.map((provider) => ({ regionId, paymentProviderId: provider.id })),
    )
    await linkService.repo('regionPaymentProvider').createMany(links)
    console.info(`Seeded ${links.length} region-payment-provider links`)
  } else {
    console.info(`Skipped region payment providers (${existingRegionProviders.length} already exist)`)
  }

  return { regions }
}
