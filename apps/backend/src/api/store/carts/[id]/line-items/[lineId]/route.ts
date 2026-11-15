import { ErrorTypes } from '@core/errors/app-error.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  DeleteResponse,
  LineIdParams,
  StoreUpdateCartLineItemResponse,
  UpdateLineItem,
} from '@proteus/http-schemas/store'
import { updateLineItemWorkflow } from '@workflows/cart/update-line-item.js'
import { lineItemStockProjection } from '@workflows/cart/utils/line-item-stock.js'
import { buildAvailableQuantities } from '@workflows/product/utils/build-variant-stock.js'

export const PostInput = { params: LineIdParams, body: UpdateLineItem }
export const PostOutput = StoreUpdateCartLineItemResponse
export const PostThrows = [...updateLineItemWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const lineItem = await updateLineItemWorkflow.run({
    cartId: req.params.id,
    lineItemId: req.params.lineId,
    quantity: req.body.quantity,
  })

  const cartService = req.scope.resolve(Modules.CART)
  const productService = req.scope.resolve(Modules.PRODUCT)
  const inventoryService = req.scope.resolve(Modules.INVENTORY)
  const storeService = req.scope.resolve(Modules.STORE)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)

  // The stock the line answers with is read after the write, the way `GET /store/carts/:id` reads
  // it, so the stepper the response redraws stops where the cart page would.
  const variantIds = lineItem.variantId ? [lineItem.variantId] : []
  const [variants, inventoryLinks, store] = await Promise.all([
    variantIds.length > 0 ? productService.listProductVariants({ id: variantIds }) : [],
    linkService.repo('productVariantInventoryItem').findByVariantIds(variantIds),
    storeService.resolveStore(),
  ])
  const itemIds = [...new Set(inventoryLinks.map((link) => link.inventoryItemId))]
  const levels = itemIds.length > 0 ? await inventoryService.listInventoryLevels({ inventoryItemId: itemIds }) : []
  const stockOf = lineItemStockProjection(
    variants,
    inventoryLinks,
    buildAvailableQuantities(levels),
    store?.lowStockThreshold ?? null,
  )

  return { status: 200, json: { lineItem: { ...cartService.enrichLineItem(lineItem), ...stockOf(lineItem) } } }
}

export const DeleteInput = { params: LineIdParams }
export const DeleteOutput = DeleteResponse
// removeLineItem throws NOT_FOUND (no such cart, or a line the cart does not hold) and NOT_ALLOWED
// (a completed cart) from the cart module
// ast-grep-ignore: route-declares-unthrown-error
export const DeleteThrows = [ErrorTypes.NOT_FOUND, ErrorTypes.NOT_ALLOWED] as const

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const cartService = req.scope.resolve(Modules.CART)
  await cartService.removeLineItem(req.params.id, req.params.lineId)

  return { status: 200, json: { id: req.params.lineId, deleted: true } }
}
