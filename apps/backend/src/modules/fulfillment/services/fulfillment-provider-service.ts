import type { AwilixContainer } from 'awilix'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { FindConfig } from '../../../core/types/common.js'
import type { Context } from '../../../core/types/context.js'
import type {
  FilterableFulfillmentProviderProps,
  FulfillmentProviderDTO,
} from '../../../core/types/fulfillment/common.js'
import type { CreateFulfillmentProviderDTO } from '../../../core/types/fulfillment/mutations.js'
import type {
  CalculateShippingPriceContext,
  CreateProviderFulfillmentInput,
  IFulfillmentProvider,
} from '../../../core/types/fulfillment/provider.js'
import type { Logger } from '../../../core/types/logger.js'
import type { FulfillmentProviderRepository } from '../repositories/fulfillment-provider.js'

type InjectedDependencies = {
  container: AwilixContainer
  fulfillmentProviderRepository: FulfillmentProviderRepository
  logger: Logger
}

export class FulfillmentProviderService {
  private container: AwilixContainer
  private fulfillmentProviderRepository: FulfillmentProviderRepository
  private logger: Logger

  constructor({ container, fulfillmentProviderRepository, logger }: InjectedDependencies) {
    this.container = container
    this.fulfillmentProviderRepository = fulfillmentProviderRepository
    this.logger = logger
  }

  retrieveProvider(providerId: string): IFulfillmentProvider {
    try {
      return this.container.resolve<IFulfillmentProvider>(providerId)
    } catch {
      throw new AppError({
        type: ErrorTypes.NOT_FOUND,
        message: `Fulfillment provider "${providerId}" is not registered.`,
      })
    }
  }

  // -- Provider table CRUD --

  async list(
    filters?: FilterableFulfillmentProviderProps,
    config?: FindConfig<FulfillmentProviderDTO>,
    context?: Context,
  ): Promise<FulfillmentProviderDTO[]> {
    return this.fulfillmentProviderRepository.find(filters, config, context)
  }

  async upsert(providers: CreateFulfillmentProviderDTO[], context?: Context): Promise<void> {
    await Promise.all(
      providers.map(async (provider) => {
        const existing = await this.fulfillmentProviderRepository.findById(provider.id, undefined, context)
        if (existing) {
          this.logger.debug(`Updating fulfillment provider "${provider.id}"`)
          await this.fulfillmentProviderRepository.update(
            provider.id,
            { isEnabled: provider.isEnabled ?? true },
            context,
          )
        } else {
          this.logger.debug(`Registering new fulfillment provider "${provider.id}"`)
          await this.fulfillmentProviderRepository.create(provider, context)
        }
      }),
    )
  }

  // -- Delegate to provider instances --

  async validateFulfillmentData(
    providerId: string,
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const provider = this.retrieveProvider(providerId)
    return provider.validateFulfillmentData(optionData, data, context)
  }

  async validateOption(providerId: string, data: Record<string, unknown>): Promise<boolean> {
    const provider = this.retrieveProvider(providerId)
    return provider.validateOption(data)
  }

  async canCalculate(providerId: string, data: Record<string, unknown>): Promise<boolean> {
    const provider = this.retrieveProvider(providerId)
    return provider.canCalculate(data)
  }

  async calculatePrice(
    providerId: string,
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: CalculateShippingPriceContext,
  ): Promise<{ amount: number }> {
    this.logger.debug(`Calculating price via provider "${providerId}"`)
    const provider = this.retrieveProvider(providerId)
    return provider.calculatePrice(optionData, data, context)
  }

  async createFulfillment(
    providerId: string,
    input: CreateProviderFulfillmentInput,
  ): Promise<{ data: Record<string, unknown> }> {
    this.logger.debug(`Creating fulfillment via provider "${providerId}"`)
    const provider = this.retrieveProvider(providerId)
    return provider.createFulfillment(input)
  }

  async cancelFulfillment(providerId: string, fulfillment: Record<string, unknown>): Promise<void> {
    this.logger.debug(`Canceling fulfillment via provider "${providerId}"`)
    const provider = this.retrieveProvider(providerId)
    return provider.cancelFulfillment(fulfillment)
  }
}
