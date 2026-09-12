import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IRegionModuleService, IStoreModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminStoreResponse, AdminUpdateStore } from '@proteus/http-schemas/admin'
import { NO_STORE_CONFIGURED, storeWithCurrencies } from '@workflows/store/utils/store-with-currencies.js'

export const GetOutput = AdminStoreResponse
export const GetThrows = [ErrorTypes.NOT_FOUND] as const

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

  const store = await storeService.resolveStore()
  if (!store) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: NO_STORE_CONFIGURED })
  }

  const currencies = await storeService.listStoreCurrencies({ storeId: store.id })

  return { status: 200, json: { store: storeWithCurrencies(store, currencies) } }
}

export const PostInput = { body: AdminUpdateStore }
export const PostOutput = AdminStoreResponse
export const PostThrows = [ErrorTypes.NOT_FOUND, ErrorTypes.INVALID_DATA] as const

/**
 * Edits the store's details.
 *
 * POST rather than PATCH, matching the region editor this drawer sits beside. Every field is
 * optional and each is written only when the body mentions it, so renaming the store leaves the
 * default region alone — and a body that mentions nothing is a no-op rather than an error, because
 * an update with no columns to set is what the repository refuses.
 *
 * The default region is checked against the region module rather than trusted. `store.default_region_id`
 * carries no foreign key — regions live in another module, and no key crosses that boundary — so an
 * id naming nothing would be stored happily and read back as a storefront serving shoppers from a
 * region that does not exist. `INVALID_DATA`, not `NOT_FOUND`: the store was found; the body named
 * a region that was not.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const storeService = req.scope.resolve<IStoreModuleService>(Modules.STORE)
  const regionService = req.scope.resolve<IRegionModuleService>(Modules.REGION)

  const store = await storeService.resolveStore()
  if (!store) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: NO_STORE_CONFIGURED })
  }

  const { name, defaultRegionId } = req.body

  if (defaultRegionId) {
    const [region] = await regionService.listRegions({ id: defaultRegionId })
    if (!region) {
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: `No region "${defaultRegionId}" exists, so the store cannot default to it`,
      })
    }
  }

  const changes = {
    ...(name !== undefined && { name }),
    ...(defaultRegionId !== undefined && { defaultRegionId }),
  }
  const [updated] = Object.keys(changes).length ? await storeService.updateStores([store.id], changes) : [store]

  const currencies = await storeService.listStoreCurrencies({ storeId: store.id })

  return { status: 200, json: { store: storeWithCurrencies(updated ?? store, currencies) } }
}
