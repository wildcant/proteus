import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IStoreModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminStoreResponse, StoreCurrencyParams } from '@proteus/http-schemas/admin'
import { NO_STORE_CONFIGURED, storeWithCurrencies } from '@workflows/store/utils/store-with-currencies.js'

export const PostInput = { params: StoreCurrencyParams }
export const PostOutput = AdminStoreResponse
export const PostThrows = [ErrorTypes.NOT_FOUND] as const

/**
 * Nominates the currency the store is denominated in.
 *
 * Its own route rather than a field on the store, because the flag it moves lives on the currency
 * row and the screen that moves it is that row's menu — the same shape the storefront's
 * `payment-methods/:id/default` already takes.
 *
 * The demotion and the promotion are one transaction inside the store module, so there is no
 * moment with two defaults and none with zero. A code the store does not hold is a 404 raised
 * there, for the same reason it is one here: under this store it is not a resource at all.
 *
 * Answers with the store because nominating a default reorders the currency list — the default
 * leads — and a client that had to refetch to learn its own new order would render the old one for
 * a round trip.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const storeService = req.scope.resolve<IStoreModuleService>(Modules.STORE)

  const store = await storeService.resolveStore()
  if (!store) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: NO_STORE_CONFIGURED })
  }

  const currencies = await storeService.setDefaultStoreCurrency(store.id, req.params.code)

  return { status: 200, json: { store: storeWithCurrencies(store, currencies) } }
}
