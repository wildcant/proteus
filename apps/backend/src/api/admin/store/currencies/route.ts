import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IStoreModuleService } from '@core/types/store/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminAddStoreCurrencies, AdminStoreResponse } from '@proteus/http-schemas/admin'
import { NO_STORE_CONFIGURED, storeWithCurrencies } from '@workflows/store/utils/store-with-currencies.js'

export const PostInput = { body: AdminAddStoreCurrencies }
export const PostOutput = AdminStoreResponse
export const PostThrows = [ErrorTypes.NOT_FOUND] as const

/**
 * Starts trading in more currencies.
 *
 * This is the write the whole feature turns on. A currency added here becomes a price column in
 * the variant editor and a currency a region may settle in, so it is the act that opens a market
 * rather than a setting that describes one.
 *
 * A code the store already holds is ignored rather than refused: the picker offers only unheld
 * codes, so a duplicate means two tabs or a double click, and answering that with a duplicate-key
 * error would report the merchant's own success back to them as a failure.
 *
 * 200 rather than 201, and the store rather than the rows: nothing here is addressable on its own,
 * and adding the first currency to a store that had none also names its default — so the answer is
 * the state both cards on the screen re-render from.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const storeService = req.scope.resolve<IStoreModuleService>(Modules.STORE)

  const store = await storeService.resolveStore()
  if (!store) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: NO_STORE_CONFIGURED })
  }

  const currencies = await storeService.createStoreCurrencies(store.id, req.body.currencyCodes)

  return { status: 200, json: { store: storeWithCurrencies(store, currencies) } }
}
