import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IStoreModuleService, StoreCurrencyDTO } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AdminStoreResponse } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetOutput = AdminStoreResponse
export const GetThrows = [ErrorTypes.NOT_FOUND] as const

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
 * The store and the currencies it sells in.
 *
 * No id in the path, because a deployment has exactly one store — the same resolution the store
 * API's pricing context makes, oldest first, so both namespaces answer for the same row. A
 * deployment with none is a 404 rather than an empty body: every caller here needs a store to
 * describe, and inventing one would let a price form quote money the store does not sell in.
 */
export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const storeService = req.scope.resolve<IStoreModuleService>(Modules.STORE)

  const [store] = await storeService.listStores(undefined, { limit: 1, order: { createdAt: 'ASC' } })
  if (!store) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: 'No store is configured' })
  }

  const currencies = await storeService.listStoreCurrencies({ storeId: store.id })

  return {
    status: 200,
    json: {
      store: {
        id: store.id,
        name: store.name,
        defaultRegionId: store.defaultRegionId,
        currencies: [...currencies].sort(byDefaultThenCode).map((currency) => ({
          currencyCode: currency.currencyCode,
          isDefault: currency.isDefault,
        })),
      },
    },
  }
}
