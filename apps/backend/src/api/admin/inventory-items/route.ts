import type { ILinkService } from '@core/types/link/service.js'
import type { IStoreModuleService } from '@core/types/store/service.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminInventoryItemListParams, AdminInventoryItemListResponse } from '@proteus/http-schemas/admin'

export const GetInput = { query: AdminInventoryItemListParams }
export const GetOutput = AdminInventoryItemListResponse

/**
 * What the shop has, one row per tracked variant, so reordering does not mean opening every
 * product. Read-only by design: the number is set on the variant, next to its price.
 */
export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
  const storeService = req.scope.resolve<IStoreModuleService>(Modules.STORE)
  const { pagination, filters } = req.validatedQuery
  const { offset, limit } = pagination

  // A shop that has set no threshold has no answer to "what is running low", so the filter
  // narrows to nothing rather than failing the whole list on a setting nobody filled in.
  const store = await storeService.resolveStore()
  const threshold = store?.lowStockThreshold ?? null
  if (filters.lowStock && threshold === null) {
    return { status: 200, json: { inventoryItems: [], count: 0, offset, limit } }
  }

  const [rows, count] = await linkService.repo('productVariantInventoryItem').listVariantStockAndCount({
    limit,
    offset,
    order: pagination.order,
    ...(filters.lowStock && threshold !== null && { atOrBelow: threshold }),
  })

  const inventoryItems = rows.map((row) => ({
    ...row,
    lowStock: threshold !== null && row.availableQuantity <= threshold,
  }))

  return { status: 200, json: { inventoryItems, count, offset, limit } }
}
