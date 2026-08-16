import type { BigNumber } from '../../../core/db/bignum.js'
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
  UpdatePriceSetDTO,
  UpsertPriceSetDTO,
} from '../../../core/types/index.js'
import type { Logger } from '../../../core/types/logger.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { PriceRepository } from '../repositories/price.js'
import type { PriceSetRepository } from '../repositories/price-set.js'

type NormalizedPrice = { currencyCode: string; amount: BigNumber; priceSetId: string }

// Deterministic identity hash for a price entry.
// TODO(pricing): extend with priceListId, minQuantity, maxQuantity, and rules when those arrive.
function hashPrice(price: { currencyCode: string; priceSetId: string }): string {
  const parts: string[] = []
  parts.push(`cc:${price.currencyCode.toLowerCase()}`)
  parts.push(`ps:${price.priceSetId}`)
  return parts.sort().join('|')
}

// Deduplicates incoming prices: last-one-wins per hash key.
function normalizePrices(prices: CreatePriceDTO[], priceSetId: string): NormalizedPrice[] {
  const map = new Map<string, NormalizedPrice>()
  for (const price of prices) {
    const normalized: NormalizedPrice = {
      currencyCode: price.currencyCode.toLowerCase(),
      amount: price.amount,
      priceSetId,
    }
    map.set(hashPrice(normalized), normalized)
  }
  return Array.from(map.values())
}

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
        await this.priceRepository.createMany(normalizePrices(data.prices, priceSet.id), ctx)
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

      const priceSetsWithPrices = priceSets
        .map((priceSet, index) => ({ priceSet, prices: data[index]?.prices }))
        .filter((entry): entry is typeof entry & { prices: CreatePriceDTO[] } => !!entry.prices?.length)

      await Promise.all(
        priceSetsWithPrices.map((entry) =>
          this.priceRepository.createMany(normalizePrices(entry.prices, entry.priceSet.id), ctx),
        ),
      )

      return priceSets
    })
  }

  async deletePriceSets(priceSetIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      // Prices cascade-delete via FK onDelete: 'cascade', but soft-delete the prices first
      const prices = await this.priceRepository.find({ priceSetId: priceSetIds }, undefined, ctx)
      const priceIds = prices.map((price) => price.id)
      if (priceIds.length) {
        await this.priceRepository.softDelete(priceIds, ctx)
      }
      await this.priceSetRepository.softDelete(priceSetIds, ctx)
    })
  }

  async upsertPriceSets(data: UpsertPriceSetDTO[], context?: Context): Promise<PriceSetDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      const forCreate = data.filter((priceSet): priceSet is CreatePriceSetDTO => !('id' in priceSet))
      const forUpdate = data.filter((priceSet): priceSet is UpdatePriceSetDTO => 'id' in priceSet)

      const created = forCreate.length > 0 ? await this.createPriceSets(forCreate, ctx) : []
      const updated = forUpdate.length > 0 ? await this.updatePriceSets(forUpdate, ctx) : []

      return [...created, ...updated]
    })
  }

  private async updatePriceSets(data: UpdatePriceSetDTO[], context?: Context): Promise<PriceSetDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return Promise.all(data.map((entry) => this.updatePriceSet(entry, ctx)))
    })
  }

  private async updatePriceSet(data: UpdatePriceSetDTO, context?: Context): Promise<PriceSetDTO> {
    return this.withTransaction(context, async (ctx) => {
      const priceSet = await this.priceSetRepository.findByIdOrFail(data.id, undefined, ctx)

      if (!data.prices) return priceSet

      const existing = await this.priceRepository.find({ priceSetId: data.id }, undefined, ctx)
      const existingById = new Map(existing.map((price) => [price.id, price]))

      const toCreate = data.prices.filter((price) => !price.id)
      const toUpdate = data.prices.filter((price) => price.id && existingById.has(price.id))
      const incomingIds = new Set(data.prices.filter((price) => price.id).map((price) => price.id))
      const toDelete = existing.filter((price) => !incomingIds.has(price.id))

      if (toCreate.length > 0) {
        await this.priceRepository.createMany(
          normalizePrices(
            toCreate.map((price) => ({ currencyCode: price.currencyCode, amount: price.amount })),
            data.id,
          ),
          ctx,
        )
      }

      await Promise.all(
        toUpdate
          .filter((price): price is typeof price & { id: string } => typeof price.id === 'string')
          .map((price) => this.priceRepository.update(price.id, { amount: price.amount }, ctx)),
      )

      if (toDelete.length > 0) {
        await this.priceRepository.softDelete(
          toDelete.map((price) => price.id),
          ctx,
        )
      }

      return priceSet
    })
  }

  async addPrice(priceSetId: string, price: CreatePriceDTO, context?: Context): Promise<PriceDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.priceRepository.create(
        { currencyCode: price.currencyCode.toLowerCase(), amount: price.amount, priceSetId },
        ctx,
      )
    })
  }

  async addPrices(priceSetId: string, prices: CreatePriceDTO[], context?: Context): Promise<PriceDTO[]> {
    this.logger.debug(`Adding ${prices.length} price(s) to price set ${priceSetId}`)
    return this.withTransaction(context, async (ctx) => {
      return this.priceRepository.createMany(normalizePrices(prices, priceSetId), ctx)
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
    priceSetIds: string[],
    pricingContext: PricingContext,
    context?: Context,
  ): Promise<CalculatedPriceSet[]> {
    // TODO(pricing): when PriceRule exists, apply rule matching and specificity ordering
    // TODO(pricing): when PriceList exists, apply SALE vs OVERRIDE logic
    // For now: first matching price wins (one price per set per currency)
    if (priceSetIds.length === 0) return []

    const prices = await this.priceRepository.findByPriceSetIds(priceSetIds, pricingContext.currencyCode, context)

    return prices.map((price) => ({
      id: price.priceSetId,
      calculatedAmount: price.amount,
      currencyCode: price.currencyCode,
    }))
  }
}
