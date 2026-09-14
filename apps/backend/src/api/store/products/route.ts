import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { IPricingModuleService } from '@core/types/pricing/service.js'
import type { IProductModuleService } from '@core/types/product/service.js'
import type { IStoreModuleService } from '@core/types/store/service.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  StorePricingContextParams,
  StoreProductListParams,
  StoreProductListResponse,
} from '@proteus/http-schemas/store'
import { buildStartingPrices } from '@workflows/product/utils/build-starting-prices.js'
import { buildVariantPrices } from '@workflows/product/utils/build-variant-prices.js'
import { isPurchasable, variantStockProjection } from '@workflows/product/utils/build-variant-stock.js'
import { setPricingContext } from '../middlewares.js'

export const GetInput = { query: StoreProductListParams, contextQuery: StorePricingContextParams }
export const GetMiddlewares = [setPricingContext()] as const
export const GetOutput = StoreProductListResponse

export const GET = async (
  req: HttpRequest<typeof GetInput, typeof GetMiddlewares>,
): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve<IProductModuleService>(Modules.PRODUCT)
  const pricingService = req.scope.resolve<IPricingModuleService>(Modules.PRICING)
  const inventoryService = req.scope.resolve<IInventoryModuleService>(Modules.INVENTORY)
  const storeService = req.scope.resolve<IStoreModuleService>(Modules.STORE)
  const linkService = req.scope.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  const { pagination, filters } = req.validatedQuery
  const { offset, limit } = pagination

  /**
   * Pricing decides the catalogue, so it is resolved before the page is drawn rather than after.
   *
   * The admin writes one price row per variant in one currency, so a product the store cannot
   * quote in this market is now an ordinary occurrence rather than an impossible one — and a
   * shopper is shown no card rather than a card with no price. Filtering an already-paged result
   * would hide the product but leave `count` promising rows no page can reach and pages shorter
   * than the `limit` they were asked for; restricting the query itself keeps `count`, `offset`
   * and `limit` describing the list that actually comes back.
   *
   * Same number of round trips as paging first — the variants, links and prices this reads are
   * the ones the response needs anyway — over the whole catalogue rather than one page of it.
   */
  const variants = await productService.listProductVariants()
  const links = await linkService.repo('productVariantPriceSet').findByVariantIds(variants.map((variant) => variant.id))

  const priceSetIds = [...new Set(links.map((link) => link.priceSetId))]
  const calculatedPrices = await pricingService.calculatePrices(priceSetIds, req.pricingContext)

  const priceByVariantId = buildVariantPrices(links, calculatedPrices)
  const startingPriceByProductId = buildStartingPrices(variants, links, calculatedPrices)
  const sellableProductIds = [...startingPriceByProductId.keys()]

  // An empty filter array would reach the query builder as `inArray(column, [])`, and a market
  // that can price nothing has no page to draw either way.
  if (sellableProductIds.length === 0) return { status: 200, json: { products: [], count: 0, offset, limit } }

  const [products, count] = await productService.listAndCountProducts(
    { ...filters, status: 'published', id: sellableProductIds },
    pagination,
  )

  /**
   * The grid's stock answer, at the product's grain: sold out when no variant of it can be bought.
   *
   * Read for the page that is being drawn rather than for the catalogue the pricing filter walked,
   * because this is the one part of the response that costs a query per inventory item — and a
   * card the shopper will never scroll to does not need its badge resolved.
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
  const [availableQuantities, store] = await Promise.all([
    Promise.all(
      itemIds.map(async (itemId) => [itemId, await inventoryService.retrieveAvailableQuantity(itemId)] as const),
    ),
    storeService.resolveStore(),
  ])
  const stockOf = variantStockProjection(inventoryLinks, new Map(availableQuantities), store?.lowStockThreshold ?? null)

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
