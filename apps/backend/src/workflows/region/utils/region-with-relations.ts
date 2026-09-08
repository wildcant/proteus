import type { RegionPaymentProviderDTO } from '@core/types/link/common.js'
import type { PaymentProviderDTO } from '@core/types/payment/common.js'
import type { CountryDTO, RegionDTO } from '@core/types/region/common.js'
import type { AdminRegion } from '@proteus/http-schemas/admin'

/**
 * Attaches to a region the countries it sells to and the gateways it takes payment through —
 * three modules' rows joined where none of them can join the others.
 *
 * The caller fetches; this only joins. That is what lets the list route and the retrieve route
 * answer with the same region rather than each assembling its own idea of one and drifting. It
 * shapes nothing: the response schema strips whatever these rows carry beyond what the screens
 * read, nested countries and providers included.
 */
export function regionWithRelations(
  region: RegionDTO,
  countries: CountryDTO[],
  links: RegionPaymentProviderDTO[],
  providers: PaymentProviderDTO[],
): AdminRegion {
  const providerIds = new Set(links.filter((link) => link.regionId === region.id).map((link) => link.paymentProviderId))

  return {
    ...region,
    countries: countries.filter((country) => country.regionId === region.id),
    // Filtering the providers, rather than mapping the links, is what drops a link naming a
    // provider that is no longer registered: a gateway removed from a deployment leaves its links
    // behind, and a merchant who can still open the region is a merchant who can still repair it.
    paymentProviders: providers.filter((provider) => providerIds.has(provider.id)),
  }
}

/**
 * The same join for a page of regions.
 *
 * Filtering per region rather than indexing once is deliberate: a store has as many regions as it
 * has markets and the country table is 249 rows, so the Maps would cost more to read than they
 * save to run.
 */
export function regionsWithRelations(
  regions: RegionDTO[],
  countries: CountryDTO[],
  links: RegionPaymentProviderDTO[],
  providers: PaymentProviderDTO[],
): AdminRegion[] {
  return regions.map((region) => regionWithRelations(region, countries, links, providers))
}
