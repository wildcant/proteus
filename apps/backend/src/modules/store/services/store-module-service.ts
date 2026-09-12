import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { FindConfig } from '../../../core/types/common.js'
import type { Context } from '../../../core/types/context.js'
import type {
  FilterableStoreCurrencyProps,
  FilterableStoreProps,
  StoreCurrencyDTO,
  StoreDTO,
} from '../../../core/types/store/common.js'
import type { CreateStoreDTO, UpdateStoreDTO } from '../../../core/types/store/mutations.js'
import type { IStoreModuleService } from '../../../core/types/store/service.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { StoreRepository } from '../repositories/store.js'
import type { StoreCurrencyRepository } from '../repositories/store-currency.js'

type InjectedDependencies = {
  storeRepository: StoreRepository
  storeCurrencyRepository: StoreCurrencyRepository
  withTransaction: WithTransaction
}

export class StoreModuleService implements IStoreModuleService {
  private storeRepository: StoreRepository
  private storeCurrencyRepository: StoreCurrencyRepository
  private withTransaction: WithTransaction

  constructor({ storeRepository, storeCurrencyRepository, withTransaction }: InjectedDependencies) {
    this.storeRepository = storeRepository
    this.storeCurrencyRepository = storeCurrencyRepository
    this.withTransaction = withTransaction
  }

  async listStores(
    filters?: FilterableStoreProps,
    config?: FindConfig<StoreDTO>,
    context?: Context,
  ): Promise<StoreDTO[]> {
    return this.storeRepository.find(filters, config, context)
  }

  async retrieveStore(storeId: string, config?: FindConfig<StoreDTO>, context?: Context): Promise<StoreDTO> {
    return this.storeRepository.findByIdOrFail(storeId, config, context)
  }

  async resolveStore(context?: Context): Promise<StoreDTO | undefined> {
    const [store] = await this.storeRepository.find(undefined, { limit: 1, order: { createdAt: 'ASC' } }, context)
    return store
  }

  /** The currencies are created in the same transaction, so a store is never briefly untradeable. */
  async createStore(data: CreateStoreDTO, context?: Context): Promise<StoreDTO> {
    const { currencies, ...store } = data

    return this.withTransaction(context, async (ctx) => {
      const created = await this.storeRepository.create(store, ctx)
      if (currencies?.length) {
        await this.storeCurrencyRepository.createMany(
          currencies.map((currency) => ({ ...currency, storeId: created.id })),
          ctx,
        )
      }
      return created
    })
  }

  async updateStores(storeIds: string[], data: UpdateStoreDTO, context?: Context): Promise<StoreDTO[]> {
    return this.withTransaction(context, async (ctx) => this.storeRepository.updateMany(storeIds, data, ctx))
  }

  async softDeleteStores(storeIds: string[], context?: Context): Promise<void> {
    await this.withTransaction(context, async (ctx) => this.storeRepository.softDelete(storeIds, ctx))
  }

  async listStoreCurrencies(
    filters?: FilterableStoreCurrencyProps,
    config?: FindConfig<StoreCurrencyDTO>,
    context?: Context,
  ): Promise<StoreCurrencyDTO[]> {
    return this.storeCurrencyRepository.find(filters, config, context)
  }

  /**
   * Codes the store already holds are skipped rather than refused, so the call is idempotent: the
   * unique index would answer a repeat with a duplicate-key error, and nothing a merchant did
   * wrong should surface as one.
   *
   * A store holding no default gets one. The Store card, the price editor's leading column and the
   * money a region is checked against are all read off that flag, so a store that trades in
   * something but names no default is a store every one of those surfaces has to special-case.
   */
  async createStoreCurrencies(
    storeId: string,
    currencyCodes: string[],
    context?: Context,
  ): Promise<StoreCurrencyDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      const existing = await this.storeCurrencyRepository.find({ storeId }, undefined, ctx)
      const held = new Set(existing.map((currency) => currency.currencyCode))
      const added = [...new Set(currencyCodes)].filter((code) => !held.has(code))

      if (added.length) {
        const hasDefault = existing.some((currency) => currency.isDefault)
        await this.storeCurrencyRepository.createMany(
          added.map((currencyCode, index) => ({ storeId, currencyCode, isDefault: !hasDefault && index === 0 })),
          ctx,
        )
      }

      return this.storeCurrencyRepository.find({ storeId }, undefined, ctx)
    })
  }

  /**
   * Demoting the incumbent and promoting the nominee share one transaction, which is what makes
   * "exactly one default" a property of the store rather than of the order two writes happened to
   * land in.
   */
  async setDefaultStoreCurrency(storeId: string, currencyCode: string, context?: Context): Promise<StoreCurrencyDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      const currencies = await this.storeCurrencyRepository.find({ storeId }, undefined, ctx)
      const target = currencies.find((currency) => currency.currencyCode === currencyCode)
      if (!target) {
        throw new AppError({
          type: ErrorTypes.NOT_FOUND,
          message: `The store does not trade in "${currencyCode}"`,
        })
      }

      const demoted = currencies.filter((currency) => currency.isDefault && currency.id !== target.id)
      await this.storeCurrencyRepository.updateMany(
        demoted.map((currency) => currency.id),
        { isDefault: false },
        ctx,
      )
      await this.storeCurrencyRepository.updateMany([target.id], { isDefault: true }, ctx)

      return this.storeCurrencyRepository.find({ storeId }, undefined, ctx)
    })
  }

  async softDeleteStoreCurrencies(currencyIds: string[], context?: Context): Promise<void> {
    await this.withTransaction(context, async (ctx) => this.storeCurrencyRepository.softDelete(currencyIds, ctx))
  }
}
