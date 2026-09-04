import type { BaseFilterable, OperatorMap } from '../common.js'

export type RegionDTO = {
  id: string
  name: string
  currencyCode: string
  metadata: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableRegionProps extends BaseFilterable<FilterableRegionProps> {
  id?: string | string[]
  name?: string | OperatorMap<string>
  currencyCode?: string | string[] | OperatorMap<string>
}

export type CountryDTO = {
  /** The ISO 3166-1 alpha-2 code, lowercased. See `countryTable` for why it is the primary key. */
  id: string
  iso3: string
  numericCode: string
  name: string
  displayName: string
  /** The region that sells to this country. `null` means the store does not sell there. */
  regionId: string | null
  /** BCP 47 tag, e.g. `es-CO`. Set exactly when `regionId` is. */
  localeCode: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableCountryProps extends BaseFilterable<FilterableCountryProps> {
  id?: string | string[]
  iso3?: string | string[]
  regionId?: string | string[] | null
}

/**
 * A country as a storefront renders it: the code it is selected by, the label it is shown under,
 * and the two tags that decide how money and dates are formatted there.
 *
 * `currencyCode` and `localeCode` come from the owning region and the country row respectively,
 * so both are null exactly when the country is not sellable.
 */
export type CountryMarketDTO = {
  iso2: string
  displayName: string
  currencyCode: string | null
  localeCode: string | null
}
