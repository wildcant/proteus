import type { Context } from '@core/types/context.js'
import type {
  CreateFixtureShippingRateDTO,
  FixtureShippingRateDTO,
  IFixtureShippingRatesService,
} from '../../../types/shipping-rates.js'
import type { FixtureShippingRateRepository } from '../repositories/shipping-rate.js'

type InjectedDependencies = {
  fixtureShippingRateRepository: FixtureShippingRateRepository
}

export class FixtureShippingRatesModuleService implements IFixtureShippingRatesService {
  private fixtureShippingRateRepository: FixtureShippingRateRepository

  constructor({ fixtureShippingRateRepository }: InjectedDependencies) {
    this.fixtureShippingRateRepository = fixtureShippingRateRepository
  }

  async createShippingRates(
    data: CreateFixtureShippingRateDTO[],
    context?: Context,
  ): Promise<FixtureShippingRateDTO[]> {
    return this.fixtureShippingRateRepository.createMany(data, context)
  }

  async findRateForCity(city: string, context?: Context): Promise<FixtureShippingRateDTO | null> {
    return this.fixtureShippingRateRepository.findByCity(city, context)
  }
}
