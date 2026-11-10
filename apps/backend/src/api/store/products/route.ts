import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  StorePricingContextParams,
  StoreProductListParams,
  StoreProductListResponse,
} from '@proteus/http-schemas/store'
import { buildStoreGroupingFilters } from '@workflows/product/utils/build-store-grouping-filters.js'
import {
  buildAvailableQuantities,
  isPurchasable,
  variantStockProjection,
} from '@workflows/product/utils/build-variant-stock.js'
import { setPricingContext, setSellableProducts } from '../middlewares.js'

export const GetInput = { query: StoreProductListParams, contextQuery: StorePricingContextParams }
export const GetMiddlewares = [setPricingContext(), setSellableProducts()] as const
export const GetOutput = StoreProductListResponse

export const GET = async (
  req: HttpRequest<typeof GetInput, typeof GetMiddlewares>,
): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const inventoryService = req.scope.resolve(Modules.INVENTORY)
  const storeService = req.scope.resolve(Modules.STORE)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)

  const { pagination, filters } = req.validatedQuery
  const { offset, limit } = pagination
  const { category, collection, tag, ...columnFilters } = filters

  const { productIds: sellableProductIds, variants, priceByVariantId, startingPriceByProductId } = req.sellableProducts

  // An empty filter array would reach the query builder as `inArray(column, [])`, and a market
  // that can price nothing has no page to draw either way.
  if (sellableProductIds.length === 0) return { status: 200, json: { products: [], count: 0, offset, limit } }

  const [products, count] = await productService.listAndCountProducts(
    {
      ...columnFilters,
      ...buildStoreGroupingFilters({ category, collection, tag }),
      status: 'published',
      id: sellableProductIds,
    },
    pagination,
  )

  /**
   * The grid's stock answer, at the product's grain: sold out when no variant of it can be bought.
   *
   * Read for the page that is being drawn rather than for the catalogue the pricing filter walked,
   * because the inventory rows are the one thing here the whole catalogue does not already need —
   * and a card the shopper will never scroll to does not need its badge resolved. It is one query
   * over the levels of whatever the page holds, not one per inventory item: `limit` reaches 100 and
   * every variant has an item of its own, so per-item reads would put hundreds of concurrent
   * `SELECT`s against a pool of ten and hold it for the duration.
   *
   * Only the variants a price was found for count, which is the same set the product page would
   * offer: a variant this market cannot quote is one no shopper can buy here either, and letting
   * it keep a product out of the sold-out state would badge the card against what its page says.
   */
  const pagedProductIds = new Set(products.map((product) => product.id))
  const pagedVariants = variants.filter(
    (variant) => pagedProductIds.has(variant.productId) && priceByVariantId.has(variant.id),
  )
  const inventoryLinks = await linkService
    .repo('productVariantInventoryItem')
    .findByVariantIds(pagedVariants.map((variant) => variant.id))

  const itemIds = [...new Set(inventoryLinks.map((link) => link.inventoryItemId))]
  const [levels, store] = await Promise.all([
    // An empty filter array would reach the query builder as `inArray(column, [])`.
    itemIds.length > 0 ? inventoryService.listInventoryLevels({ inventoryItemId: itemIds }) : [],
    storeService.resolveStore(),
  ])
  const stockOf = variantStockProjection(
    inventoryLinks,
    buildAvailableQuantities(levels),
    store?.lowStockThreshold ?? null,
  )

  const purchasableProductIds = new Set(
    pagedVariants.filter((variant) => isPurchasable(stockOf(variant))).map((variant) => variant.productId),
  )

  const enrichedProducts = products.map((product) => ({
    ...product,
    startingPrice: startingPriceByProductId.get(product.id),
    soldOut: !purchasableProductIds.has(product.id),
  }))

  return { status: 200, json: { products: enrichedProducts, count, offset, limit } }
}
