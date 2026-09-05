import type {
  Context,
  CreateStoreDTO,
  FilterableStoreCurrencyProps,
  FilterableStoreProps,
  FindConfig,
  IStoreModuleService,
  StoreCurrencyDTO,
  StoreDTO,
  UpdateStoreDTO,
} from '../../../core/types/index.js'
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
}
