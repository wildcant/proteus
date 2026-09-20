import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminSetVariantStock, AdminSetVariantStockResponse, VariantIdParams } from '@proteus/http-schemas/admin'

export const PutInput = { params: VariantIdParams, body: AdminSetVariantStock }
export const PutOutput = AdminSetVariantStockResponse
export const PutThrows = [ErrorTypes.INVALID_DATA, ErrorTypes.NOT_ALLOWED, ErrorTypes.NOT_FOUND] as const

export const PUT = async (req: HttpRequest<typeof PutInput>): Promise<HttpResult<typeof PutOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const inventoryService = req.scope.resolve(Modules.INVENTORY)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)

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

  // A stock count corrected downwards is the third way Available Quantity falls, and the only one
  // with no workflow behind it. Published after the write, so the quantities it carries are the
  // ones the row now holds; a count that went up or stayed put announces nothing, because
  // `alert-low-stock` has nothing to say about a shelf that just grew.
  if (updated.stockedQuantity < level.stockedQuantity) {
    const bus = req.scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
    await bus.emit('inventory.available_decreased', {
      id: updated.id,
      version: updated.version,
      stockedQuantity: updated.stockedQuantity,
      reservedQuantity: updated.reservedQuantity,
    })
  }

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
