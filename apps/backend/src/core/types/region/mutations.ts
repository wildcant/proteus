export type CreateRegionDTO = {
  name: string
  currencyCode: string
  metadata?: string | null
}

export type UpdateRegionDTO = {
  name?: string
  currencyCode?: string
  metadata?: string | null
}

export type CreateCountryDTO = {
  /** ISO 3166-1 alpha-2, lowercased. */
  id: string
  iso3: string
  numericCode: string
  name: string
  displayName: string
  regionId?: string | null
  localeCode?: string | null
}

export type UpdateCountryDTO = {
  name?: string
  displayName?: string
  regionId?: string | null
  localeCode?: string | null
}

/** One country's market: the region that sells to it, and the locale that region reads it in. */
export type SetCountryMarketDTO = {
  /** ISO 3166-1 alpha-2, lowercased. */
  iso2: string
  /** `null` closes the market — the country stops being sold to. */
  regionId: string | null
  localeCode: string | null
}
