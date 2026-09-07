import type { IStoreModuleService, StoreCurrencyDTO, StoreDTO } from '@core/types/index.js'
import type { AdminStore } from '@proteus/http-schemas/admin'

/** What every admin store route answers with when a deployment has no store to describe. */
export const NO_STORE_CONFIGURED = 'No store is configured'

/**
 * The one store a deployment has, oldest first.
 *
 * The same resolution the storefront's pricing context and the region currency check make, so
 * every surface answers for the same row — there is no id in any of these paths precisely because
 * there is nothing to choose between.
 *
 * Returns `undefined` rather than throwing, so the route that calls it raises the 404 itself and
 * therefore documents it: a status the OpenAPI document promises has to be one the handler is seen
 * to send.
 */
export async function resolveStore(storeService: IStoreModuleService): Promise<StoreDTO | undefined> {
  const [store] = await storeService.listStores(undefined, { limit: 1, order: { createdAt: 'ASC' } })
  return store
}

/**
 * The default currency leads, then the rest alphabetically.
 *
 * The order is part of the answer rather than the caller's to impose: the admin renders one price
 * column per currency, and the money the store itself is denominated in is the one a merchant types
 * first. Sorted here so every caller draws the same columns in the same order.
 */
function byDefaultThenCode(left: StoreCurrencyDTO, right: StoreCurrencyDTO): number {
  if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
  return left.currencyCode.localeCompare(right.currencyCode)
}

/**
 * The store as every admin store route answers with it — details and currencies together.
 *
 * One shape for the reads and the writes, because a write here changes both cards on the screen:
 * adding a currency to a store that had none also names the store's default, and nominating a
 * default reorders the list. A client that had to refetch to learn either would render the old
 * answer for a round trip.
 */
export function buildStoreView(store: StoreDTO, currencies: StoreCurrencyDTO[]): AdminStore {
  return {
    id: store.id,
    name: store.name,
    defaultRegionId: store.defaultRegionId,
    currencies: [...currencies].sort(byDefaultThenCode).map((currency) => ({
      currencyCode: currency.currencyCode,
      isDefault: currency.isDefault,
    })),
  }
}
