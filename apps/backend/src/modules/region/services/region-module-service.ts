import type {
  Context,
  CountryDTO,
  CountryMarketDTO,
  CreateCountryDTO,
  CreateRegionDTO,
  FilterableCountryProps,
  FilterableRegionProps,
  FindConfig,
  IRegionModuleService,
  ListCountryMarketsFilters,
  RegionDTO,
  UpdateCountryDTO,
  UpdateRegionDTO,
} from '../../../core/types/index.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { CountryRepository } from '../repositories/country.js'
import type { RegionRepository } from '../repositories/region.js'

type InjectedDependencies = {
  regionRepository: RegionRepository
  countryRepository: CountryRepository
  withTransaction: WithTransaction
}

export class RegionModuleService implements IRegionModuleService {
  private regionRepository: RegionRepository
  private countryRepository: CountryRepository
  private withTransaction: WithTransaction

  constructor({ regionRepository, countryRepository, withTransaction }: InjectedDependencies) {
    this.regionRepository = regionRepository
    this.countryRepository = countryRepository
    this.withTransaction = withTransaction
  }

  async listRegions(
    filters?: FilterableRegionProps,
    config?: FindConfig<RegionDTO>,
    context?: Context,
  ): Promise<RegionDTO[]> {
    return this.regionRepository.find(filters, config, context)
  }

  async retrieveRegion(regionId: string, config?: FindConfig<RegionDTO>, context?: Context): Promise<RegionDTO> {
    return this.regionRepository.findByIdOrFail(regionId, config, context)
  }

  async createRegion(data: CreateRegionDTO, context?: Context): Promise<RegionDTO> {
    return this.withTransaction(context, async (ctx) => this.regionRepository.create(data, ctx))
  }

  async createRegions(data: CreateRegionDTO[], context?: Context): Promise<RegionDTO[]> {
    return this.withTransaction(context, async (ctx) => this.regionRepository.createMany(data, ctx))
  }

  async updateRegions(regionIds: string[], data: UpdateRegionDTO, context?: Context): Promise<RegionDTO[]> {
    return this.withTransaction(context, async (ctx) => this.regionRepository.updateMany(regionIds, data, ctx))
  }

  async softDeleteRegions(regionIds: string[], context?: Context): Promise<void> {
    await this.withTransaction(context, async (ctx) => this.regionRepository.softDelete(regionIds, ctx))
  }

  async listCountries(
    filters?: FilterableCountryProps,
    config?: FindConfig<CountryDTO>,
    context?: Context,
  ): Promise<CountryDTO[]> {
    return this.countryRepository.find(filters, config, context)
  }

  async retrieveCountry(iso2: string, config?: FindConfig<CountryDTO>, context?: Context): Promise<CountryDTO> {
    return this.countryRepository.findByIdOrFail(iso2, config, context)
  }

  async createCountries(data: CreateCountryDTO[], context?: Context): Promise<CountryDTO[]> {
    return this.withTransaction(context, async (ctx) => this.countryRepository.createMany(data, ctx))
  }

  async updateCountries(iso2Codes: string[], data: UpdateCountryDTO, context?: Context): Promise<CountryDTO[]> {
    return this.withTransaction(context, async (ctx) => this.countryRepository.updateMany(iso2Codes, data, ctx))
  }

  async listCountryMarkets(filters?: ListCountryMarketsFilters, context?: Context): Promise<CountryMarketDTO[]> {
    return this.countryRepository.findMarkets(filters?.onlySellable ?? true, context)
  }
}
