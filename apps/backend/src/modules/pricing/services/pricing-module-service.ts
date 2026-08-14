import type {
  CalculatedPriceSet,
  Context,
  CreatePriceDTO,
  CreatePriceSetDTO,
  FilterablePriceProps,
  FindConfig,
  IPricingModuleService,
  PriceDTO,
  PriceSetDTO,
  PricingContext,
  UpdatePriceDTO,
} from '../../../core/types/index.js'
import type { Logger } from '../../../core/types/logger.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { PriceRepository } from '../repositories/price.js'
import type { PriceSetRepository } from '../repositories/price-set.js'

type InjectedDependencies = {
  priceSetRepository: PriceSetRepository
  priceRepository: PriceRepository
  withTransaction: WithTransaction
  logger: Logger
}

export class PricingModuleService implements IPricingModuleService {
  private priceSetRepository: PriceSetRepository
  private priceRepository: PriceRepository
  private withTransaction: WithTransaction
  private logger: Logger

  constructor({ priceSetRepository, priceRepository, withTransaction, logger }: InjectedDependencies) {
    this.priceSetRepository = priceSetRepository
    this.priceRepository = priceRepository
    this.withTransaction = withTransaction
    this.logger = logger
  }

  async createPriceSet(data: CreatePriceSetDTO, context?: Context): Promise<PriceSetDTO> {
    return this.withTransaction(context, async (ctx) => {
      const priceSet = await this.priceSetRepository.create({}, ctx)
      if (data.prices?.length) {
        await this.priceRepository.createMany(
          data.prices.map((price) => ({
            currencyCode: price.currencyCode,
            amount: price.amount,
            priceSetId: priceSet.id,
          })),
          ctx,
        )
      }
      return priceSet
    })
  }

  async createPriceSets(data: CreatePriceSetDTO[], context?: Context): Promise<PriceSetDTO[]> {
    this.logger.debug(`Creating ${data.length} price set(s)`)
    return this.withTransaction(context, async (ctx) => {
      const priceSets = await this.priceSetRepository.createMany(
        data.map(() => ({})),
        ctx,
      )

      for (const [index, priceSet] of priceSets.entries()) {
        const input = data[index]
        if (input?.prices?.length) {
          await this.priceRepository.createMany(
            input.prices.map((price) => ({
              currencyCode: price.currencyCode,
              amount: price.amount,
              priceSetId: priceSet.id,
            })),
            ctx,
          )
        }
      }

      return priceSets
    })
  }

  async deletePriceSets(priceSetIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      // Prices cascade-delete via FK onDelete: 'cascade', but soft-delete the prices first
      const prices = await this.priceRepository.find({ priceSetId: priceSetIds }, undefined, ctx)
      const priceIds = prices.map((p) => p.id)
      if (priceIds.length) {
        await this.priceRepository.softDelete(priceIds, ctx)
      }
      await this.priceSetRepository.softDelete(priceSetIds, ctx)
    })
  }

  async addPrice(priceSetId: string, price: CreatePriceDTO, context?: Context): Promise<PriceDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.priceRepository.create(
        { currencyCode: price.currencyCode, amount: price.amount, priceSetId },
        ctx,
      )
    })
  }

  async addPrices(priceSetId: string, prices: CreatePriceDTO[], context?: Context): Promise<PriceDTO[]> {
    this.logger.debug(`Adding ${prices.length} price(s) to price set ${priceSetId}`)
    return this.withTransaction(context, async (ctx) => {
      return this.priceRepository.createMany(
        prices.map((price) => ({
          currencyCode: price.currencyCode,
          amount: price.amount,
          priceSetId,
        })),
        ctx,
      )
    })
  }

  async updatePrice(priceId: string, data: UpdatePriceDTO, context?: Context): Promise<PriceDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.priceRepository.update(priceId, data, ctx)
    })
  }

  async updatePrices(priceIds: string[], data: UpdatePriceDTO, context?: Context): Promise<PriceDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.priceRepository.updateMany(priceIds, data, ctx)
    })
  }

  async removePrices(priceIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.priceRepository.softDelete(priceIds, ctx)
    })
  }

  async listPrices(
    filters?: FilterablePriceProps,
    config?: FindConfig<PriceDTO>,
    context?: Context,
  ): Promise<PriceDTO[]> {
    return this.priceRepository.find(filters, config, context)
  }

  async calculatePrices(
    _priceSetIds: string[],
    _pricingContext: PricingContext,
    _context?: Context,
  ): Promise<CalculatedPriceSet[]> {
    // Implementation deferred to ticket 02
    throw new Error('calculatePrices is not yet implemented')
  }
}
