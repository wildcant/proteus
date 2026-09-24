import type { FindConfig } from '../../../core/types/common.js'
import type { Context } from '../../../core/types/context.js'
import type {
  CountryDTO,
  CountryMarketDTO,
  FilterableCountryProps,
  FilterableRegionProps,
  RegionDTO,
} from '../../../core/types/region/common.js'
import type {
  CreateCountryDTO,
  CreateRegionDTO,
  SetCountryMarketDTO,
  UpdateCountryDTO,
  UpdateRegionDTO,
} from '../../../core/types/region/mutations.js'
import type { IRegionModuleService, ListCountryMarketsFilters } from '../../../core/types/region/service.js'
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

  async setCountryMarkets(markets: SetCountryMarketDTO[], context?: Context): Promise<CountryDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      const updated: CountryDTO[] = []
      // Sequential rather than Promise.all: the statements share one transaction's connection, and
      // the transaction is the whole point — it is what makes the batch all-or-none.
      for (const market of markets) {
        const rows = await this.countryRepository.updateMany(
          [market.iso2],
          { regionId: market.regionId, localeCode: market.localeCode },
          ctx,
        )
        updated.push(...rows)
      }
      return updated
    })
  }

  async listCountryMarkets(filters?: ListCountryMarketsFilters, context?: Context): Promise<CountryMarketDTO[]> {
    return this.countryRepository.findMarkets(
      { onlySellable: filters?.onlySellable ?? true, regionId: filters?.regionId },
      context,
    )
  }

  async retrieveRegionMarket(regionId: string, context?: Context): Promise<CountryMarketDTO | null> {
    const [market] = await this.listCountryMarkets({ regionId }, context)
    return market ?? null
  }
}
