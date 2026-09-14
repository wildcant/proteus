import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { IProductModuleService } from '@core/types/product/service.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminSetVariantStock, AdminSetVariantStockResponse, VariantIdParams } from '@proteus/http-schemas/admin'

export const PutInput = { params: VariantIdParams, body: AdminSetVariantStock }
export const PutOutput = AdminSetVariantStockResponse
export const PutThrows = [ErrorTypes.INVALID_DATA, ErrorTypes.NOT_ALLOWED, ErrorTypes.NOT_FOUND] as const

export const PUT = async (req: HttpRequest<typeof PutInput>): Promise<HttpResult<typeof PutOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const inventoryService = req.scope.resolve<IInventoryModuleService>(Modules.INVENTORY)
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  const variant = await productService.retrieveProductVariant(req.params.variantId)
  if (!variant.manageInventory) {
    throw new AppError({
      type: ErrorTypes.NOT_ALLOWED,
      message: `Stock cannot be set for untracked variant "${variant.id}". Turn inventory tracking on first.`,
    })
  }

  const [link] = await linkService.repo('productVariantInventoryItem').findByVariantIds([variant.id])
  if (!link) {
    throw new AppError({
      type: ErrorTypes.INVALID_DATA,
      message: `Variant "${variant.id}" is tracked, but no inventory item is linked to it`,
    })
  }

  const [level] = await inventoryService.listInventoryLevels(
    { inventoryItemId: link.inventoryItemId },
    { order: { createdAt: 'ASC' }, limit: 1 },
  )
  if (!level) {
    throw new AppError({
      type: ErrorTypes.NOT_FOUND,
      message: `Inventory level not found for item ${link.inventoryItemId}`,
    })
  }

  const updated = await inventoryService.setInventoryLevelStockedQuantity(
    link.inventoryItemId,
    level.locationId,
    req.body.stockedQuantity,
  )

  // TODO(inventory-events): when slice 12 defines the Available Quantity decrease event, publish
  // it here when `updated.stockedQuantity < level.stockedQuantity` with the three quantities as
  // its dispatch identity.
  return {
    status: 200,
    json: {
      stock: {
        stockedQuantity: updated.stockedQuantity,
        reservedQuantity: updated.reservedQuantity,
        availableQuantity: updated.stockedQuantity - updated.reservedQuantity,
      },
    },
  }
}
