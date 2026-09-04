import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type { FilterableStoreCurrencyProps, FilterableStoreProps, StoreCurrencyDTO, StoreDTO } from './common.js'
import type { CreateStoreDTO, UpdateStoreDTO } from './mutations.js'

export type IStoreModuleService = {
  listStores(filters?: FilterableStoreProps, config?: FindConfig<StoreDTO>, context?: Context): Promise<StoreDTO[]>
  retrieveStore(storeId: string, config?: FindConfig<StoreDTO>, context?: Context): Promise<StoreDTO>
  createStore(data: CreateStoreDTO, context?: Context): Promise<StoreDTO>
  updateStores(storeIds: string[], data: UpdateStoreDTO, context?: Context): Promise<StoreDTO[]>
  softDeleteStores(storeIds: string[], context?: Context): Promise<void>
  listStoreCurrencies(
    filters?: FilterableStoreCurrencyProps,
    config?: FindConfig<StoreCurrencyDTO>,
    context?: Context,
  ): Promise<StoreCurrencyDTO[]>
}
