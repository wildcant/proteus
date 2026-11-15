import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { IdParams, StoreCartDetailResponse, StoreUpdateCartResponse, UpdateCart } from '@proteus/http-schemas/store'
import { updateCartWorkflow } from '@workflows/cart/update-cart.js'
import { lineItemStockProjection } from '@workflows/cart/utils/line-item-stock.js'
import { buildAvailableQuantities } from '@workflows/product/utils/build-variant-stock.js'

export const GetInput = { params: IdParams }
export const GetOutput = StoreCartDetailResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const cartService = req.scope.resolve(Modules.CART)
  const productService = req.scope.resolve(Modules.PRODUCT)
  const inventoryService = req.scope.resolve(Modules.INVENTORY)
  const storeService = req.scope.resolve(Modules.STORE)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)

  const [cart, lineItems, shippingMethods, addresses] = await Promise.all([
    cartService.retrieveCart(req.params.id),
    cartService.listLineItems({ cartId: req.params.id }),
    cartService.listShippingMethods({ cartId: req.params.id }),
    cartService.listCartAddresses({ cartId: req.params.id }),
  ])

  const shippingAddress = addresses.find((address) => address.type === 'shipping') ?? null
  const billingAddress = addresses.find((address) => address.type === 'billing') ?? null

  // Stock is read live rather than kept on the line: what the shelf holds now is what decides
  // whether the line can still be bought and where its stepper stops.
  const variantIds = [...new Set(lineItems.flatMap((lineItem) => (lineItem.variantId ? [lineItem.variantId] : [])))]
  const [variants, inventoryLinks, store] = await Promise.all([
    // An empty filter array would reach the query builder as `inArray(column, [])`.
    variantIds.length > 0 ? productService.listProductVariants({ id: variantIds }) : [],
    linkService.repo('productVariantInventoryItem').findByVariantIds(variantIds),
    storeService.resolveStore(),
  ])
  const itemIds = [...new Set(inventoryLinks.map((link) => link.inventoryItemId))]
  // Every item's levels in one read, as the product routes read them.
  const levels = itemIds.length > 0 ? await inventoryService.listInventoryLevels({ inventoryItemId: itemIds }) : []
  const stockOf = lineItemStockProjection(
    variants,
    inventoryLinks,
    buildAvailableQuantities(levels),
    store?.lowStockThreshold ?? null,
  )

  const totals = cartService.computeCartTotals({ lineItems, shippingMethods })
  const enrichedItems = cartService
    .enrichLineItems(lineItems)
    .map((lineItem) => ({ ...lineItem, ...stockOf(lineItem) }))

  return {
    status: 200,
    json: { cart: { ...cart, items: enrichedItems, shippingMethods, totals, shippingAddress, billingAddress } },
  }
}

export const PostInput = { params: IdParams, body: UpdateCart }
export const PostOutput = StoreUpdateCartResponse
export const PostThrows = [...updateCartWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const cart = await updateCartWorkflow.run({ cartId: req.params.id, ...req.body })

  return { status: 200, json: { cart } }
}
