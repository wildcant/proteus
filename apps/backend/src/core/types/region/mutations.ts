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
