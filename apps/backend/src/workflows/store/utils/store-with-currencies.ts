import type { StoreCurrencyDTO, StoreDTO } from '@core/types/store/common.js'
import type { AdminStore } from '@proteus/http-schemas/admin'

/** What every admin store route answers with when a deployment has no store to describe. */
export const NO_STORE_CONFIGURED = 'No store is configured'

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
 *
 * The sort is the whole job; the response schema does the narrowing.
 */
export function storeWithCurrencies(store: StoreDTO, currencies: StoreCurrencyDTO[]): AdminStore {
  return { ...store, currencies: [...currencies].sort(byDefaultThenCode) }
}
