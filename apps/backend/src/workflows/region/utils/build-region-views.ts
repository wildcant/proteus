import type { RegionPaymentProviderDTO } from '@core/types/link/common.js'
import type { PaymentProviderDTO } from '@core/types/payment/common.js'
import type { CountryDTO, RegionDTO } from '@core/types/region/common.js'
import type { AdminRegion } from '@proteus/http-schemas/admin'

/**
 * Stitches a region together with the countries it sells to and the gateways it takes payment
 * through — three modules' rows joined where none of them can join the others.
 *
 * The caller fetches; this only shapes. That is what lets the list route and the retrieve route
 * answer with the same region rather than each assembling its own idea of one and drifting.
 *
 * A link naming a provider row that is no longer there is dropped rather than fatal: a gateway
 * removed from a deployment leaves its links behind, and a merchant who can still open the region
 * is a merchant who can still repair it.
 */
export function buildRegionViews(
  regions: RegionDTO[],
  countries: CountryDTO[],
  links: RegionPaymentProviderDTO[],
  providers: PaymentProviderDTO[],
): AdminRegion[] {
  const relations = indexRelations(countries, links, providers)
  return regions.map((region) => viewOf(region, relations))
}

/** The same shaping for a single region, so a retrieve or a save does not index a one-row list. */
export function buildRegionView(
  region: RegionDTO,
  countries: CountryDTO[],
  links: RegionPaymentProviderDTO[],
  providers: PaymentProviderDTO[],
): AdminRegion {
  return viewOf(region, indexRelations(countries, links, providers))
}

type RegionRelations = {
  countriesByRegionId: Map<string, CountryDTO[]>
  linksByRegionId: Map<string, RegionPaymentProviderDTO[]>
  providerById: Map<string, PaymentProviderDTO>
}

function indexRelations(
  countries: CountryDTO[],
  links: RegionPaymentProviderDTO[],
  providers: PaymentProviderDTO[],
): RegionRelations {
  return {
    countriesByRegionId: groupBy(countries, (country) => country.regionId),
    linksByRegionId: groupBy(links, (link) => link.regionId),
    providerById: new Map(providers.map((provider) => [provider.id, provider])),
  }
}

function viewOf(region: RegionDTO, relations: RegionRelations): AdminRegion {
  const links = relations.linksByRegionId.get(region.id) ?? []

  return {
    id: region.id,
    name: region.name,
    currencyCode: region.currencyCode,
    countries: (relations.countriesByRegionId.get(region.id) ?? []).map((country) => ({
      id: country.id,
      displayName: country.displayName,
    })),
    paymentProviders: links
      .map((link) => relations.providerById.get(link.paymentProviderId))
      .filter((provider) => provider !== undefined)
      .map((provider) => ({ id: provider.id, isEnabled: provider.isEnabled })),
    createdAt: region.createdAt,
    updatedAt: region.updatedAt,
  }
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string | null): Map<string, T[]> {
  const grouped = new Map<string, T[]>()

  for (const row of rows) {
    const key = keyOf(row)
    if (key === null) continue
    const bucket = grouped.get(key)
    if (bucket) bucket.push(row)
    else grouped.set(key, [row])
  }

  return grouped
}
