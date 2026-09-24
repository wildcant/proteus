import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { DeleteResponse, StoreCurrencyParams } from '@proteus/http-schemas/admin'
import { i18n } from '@proteus/utils'
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
  const storeService = req.scope.resolve(Modules.STORE)
  const regionService = req.scope.resolve(Modules.REGION)
  const { code } = req.params

  const store = await storeService.resolveStore()
  if (!store) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: NO_STORE_CONFIGURED })
  }

  const [currency] = await storeService.listStoreCurrencies({ storeId: store.id, currencyCode: code })
  if (!currency) {
    throw new AppError({
      type: ErrorTypes.NOT_FOUND,
      message: i18n.t('The store does not trade in "{code}"'),
      values: { code },
    })
  }

  if (currency.isDefault) {
    throw new AppError({
      type: ErrorTypes.NOT_ALLOWED,
      message: i18n.t(
        '"{code}" is the store\'s default currency. Make another currency the default before removing it.',
      ),
      values: { code },
    })
  }

  const settling = await regionService.listRegions({ currencyCode: code })
  if (settling.length > 0) {
    const names = settling.map((region) => region.name).join(', ')
    throw new AppError({
      type: ErrorTypes.NOT_ALLOWED,
      // Two sentences, not a plural form: the English source is filled by `fillValues`, which has none.
      message:
        settling.length === 1
          ? i18n.t(
              '"{code}" is the currency {names} settles in. Change that currency on the region before removing it.',
            )
          : i18n.t(
              '"{code}" is the currency {names} settle in. Change that currency on the region before removing it.',
            ),
      values: { code, names },
    })
  }

  await storeService.softDeleteStoreCurrencies([currency.id])

  return { status: 200, json: { id: currency.id, deleted: true } }
}
