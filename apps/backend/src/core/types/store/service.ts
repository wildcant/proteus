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
  /**
   * Starts trading in these currencies, and answers with everything the store trades in after.
   *
   * Codes it already holds are ignored rather than refused, so adding a currency twice is the same
   * as adding it once — the picker offers only unheld codes, and a merchant who beat it to the
   * click should not meet a duplicate-key error.
   *
   * Answers with the whole list because the caller renders the whole list: a currency added here
   * becomes a price column in the variant editor, and the ordering of that list is part of it.
   */
  createStoreCurrencies(storeId: string, currencyCodes: string[], context?: Context): Promise<StoreCurrencyDTO[]>
  /**
   * Moves the default onto this currency, as one write.
   *
   * The store's default currency is a single row wearing a flag, so nominating a new one is two
   * writes that must not come apart: a moment with two defaults is a moment the Store card names
   * the wrong money, and a moment with none is a store that cannot say what it trades in at all.
   */
  setDefaultStoreCurrency(storeId: string, currencyCode: string, context?: Context): Promise<StoreCurrencyDTO[]>
  /** Stops trading in these currencies. Soft, so the codes are free to be added again. */
  softDeleteStoreCurrencies(currencyIds: string[], context?: Context): Promise<void>
}
