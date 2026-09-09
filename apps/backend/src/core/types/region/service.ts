import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  CountryDTO,
  CountryMarketDTO,
  FilterableCountryProps,
  FilterableRegionProps,
  RegionDTO,
} from './common.js'
import type { CreateCountryDTO, CreateRegionDTO, UpdateCountryDTO, UpdateRegionDTO } from './mutations.js'

export type ListCountryMarketsFilters = {
  /** Drops countries with no owning region. Defaults to true — the sellable listing. */
  onlySellable?: boolean
}

export type IRegionModuleService = {
  listRegions(filters?: FilterableRegionProps, config?: FindConfig<RegionDTO>, context?: Context): Promise<RegionDTO[]>
  retrieveRegion(regionId: string, config?: FindConfig<RegionDTO>, context?: Context): Promise<RegionDTO>
  createRegion(data: CreateRegionDTO, context?: Context): Promise<RegionDTO>
  createRegions(data: CreateRegionDTO[], context?: Context): Promise<RegionDTO[]>
  updateRegions(regionIds: string[], data: UpdateRegionDTO, context?: Context): Promise<RegionDTO[]>
  softDeleteRegions(regionIds: string[], context?: Context): Promise<void>
  listCountries(
    filters?: FilterableCountryProps,
    config?: FindConfig<CountryDTO>,
    context?: Context,
  ): Promise<CountryDTO[]>
  retrieveCountry(iso2: string, config?: FindConfig<CountryDTO>, context?: Context): Promise<CountryDTO>
  createCountries(data: CreateCountryDTO[], context?: Context): Promise<CountryDTO[]>
  updateCountries(iso2Codes: string[], data: UpdateCountryDTO, context?: Context): Promise<CountryDTO[]>
  /**
   * Countries with the market data a storefront renders, sorted by display name in the database
   * rather than by the caller. Every caller wants the same order, and a storefront cannot sort
   * accented names correctly with a plain string compare.
   */
  listCountryMarkets(filters?: ListCountryMarketsFilters, context?: Context): Promise<CountryMarketDTO[]>
}
