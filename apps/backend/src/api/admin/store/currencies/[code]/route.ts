import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IRegionModuleService, IStoreModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { DeleteResponse, StoreCurrencyParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { NO_STORE_CONFIGURED } from '@workflows/store/utils/store-with-currencies.js'

export const DeleteInput = { params: StoreCurrencyParams }
export const DeleteOutput = DeleteResponse
export const DeleteThrows = [ErrorTypes.NOT_FOUND, ErrorTypes.NOT_ALLOWED] as const

/**
 * Stops the store trading in a currency.
 *
 * Two refusals, and both exist because the alternative is silent breakage rather than a visible
 * failure.
 *
 * The default cannot go. It is the row the Store card names, the column the price editor leads
 * with, and the money a store with one currency is denominated in — removing it leaves every one
 * of those reading an absent row, and nothing else in this feature would report it.
 *
 * Nor can a currency a region settles in. The membership rule — a region's currency must be one of
 * the store's — is enforced when the region is written and never re-checked afterwards, so this
 * route is the exact place a live region can be stranded in money the store no longer holds. The
 * region would keep taking carts and keep pricing nothing.
 *
 * Soft, so the code is free to be added again: the unique index only holds live rows.
 */
export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const storeService = req.scope.resolve<IStoreModuleService>(Modules.STORE)
  const regionService = req.scope.resolve<IRegionModuleService>(Modules.REGION)
  const { code } = req.params

  const store = await storeService.resolveStore()
  if (!store) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: NO_STORE_CONFIGURED })
  }

  const [currency] = await storeService.listStoreCurrencies({ storeId: store.id, currencyCode: code })
  if (!currency) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: `The store does not trade in "${code}"` })
  }

  if (currency.isDefault) {
    throw new AppError({
      type: ErrorTypes.NOT_ALLOWED,
      message: `"${code}" is the store's default currency. Make another currency the default before removing it.`,
    })
  }

  const settling = await regionService.listRegions({ currencyCode: code })
  if (settling.length > 0) {
    const names = settling.map((region) => region.name).join(', ')
    const verb = settling.length === 1 ? 'settles' : 'settle'
    throw new AppError({
      type: ErrorTypes.NOT_ALLOWED,
      message: `"${code}" is the currency ${names} ${verb} in. Change that currency on the region before removing it.`,
    })
  }

  await storeService.softDeleteStoreCurrencies([currency.id])

  return { status: 200, json: { id: currency.id, deleted: true } }
}
