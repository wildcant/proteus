import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  StorePricingContextParams,
  StoreProductFilterListParams,
  StoreProductFilterListResponse,
} from '@proteus/http-schemas/store'
import { COLOR_FILTER_KEY } from '@proteus/store-config'
import { buildStoreGroupingFilters } from '@workflows/product/utils/build-store-grouping-filters.js'
import { buildPriceBounds, buildStoreProductFilters } from '@workflows/product/utils/build-store-product-filters.js'
import {
  buildAvailableQuantities,
  isPurchasable,
  variantStockProjection,
} from '@workflows/product/utils/build-variant-stock.js'
import { productsPricedWithin } from '@workflows/product/utils/products-priced-within.js'
import { listSellableProducts, setPricingContext } from '../middlewares.js'

export const GetInput = { query: StoreProductFilterListParams, contextQuery: StorePricingContextParams }
export const GetMiddlewares = [setPricingContext()] as const
export const GetOutput = StoreProductFilterListResponse

export const GET = async (
  req: HttpRequest<typeof GetInput, typeof GetMiddlewares>,
): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const inventoryService = req.scope.resolve(Modules.INVENTORY)
  const storeService = req.scope.resolve(Modules.STORE)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)

  const { category, collection, tag, filter, minPrice, maxPrice, ...columnFilters } = req.validatedQuery.filters
  const { productIds, variants, priceByVariantId } = await listSellableProducts(req.scope, req.pricingContext)
  // The price range is a selection like the others: it moves the counts, so a range that keeps
  // nothing leaves every filter in place at 0 rather than taking them away.
  const hasPriceRange = minPrice !== undefined || maxPrice !== undefined
  const pricedProductIds = hasPriceRange
    ? productsPricedWithin(variants, priceByVariantId, { minPrice, maxPrice })
    : undefined

  // An empty filter array would reach the query builder as `inArray(column, [])`.
  if (productIds.length === 0) return { status: 200, json: { filters: [], priceBounds: null } }

  // The list's scope before any selection: which values are offered, and what the price slider spans.
  const scope = {
    ...columnFilters,
    ...buildStoreGroupingFilters({ category, collection }),
    status: 'published' as const,
    id: productIds,
  }
  const [filters, inView, definitions, categories, store] = await Promise.all([
    // The same filters `GET /store/products` builds, so a count is the size of the list the value leads to.
    productService.listProductFilters({ ...scope, ...buildStoreGroupingFilters({ tag, filter }), pricedProductIds }),
    productService.listProducts(scope, { select: ['id'] }),
    productService.listMetafieldDefinitions(),
    productService.listCategories(),
    storeService.resolveStore(),
  ])

  /**
   * Which option values a shopper can still buy, over the scope's priced variants: a size every
   * product in view has sold out of is drawn disabled. Stock is read for the whole scope rather
   * than a page, since a filter answers for every product it counts — one read of the links and one
   * of the levels, the way the list reads a page's.
   */
  const inViewIds = new Set(inView.map((product) => product.id))
  const inViewVariants = variants.filter(
    (variant) => inViewIds.has(variant.productId) && priceByVariantId.has(variant.id),
  )
  const inViewVariantIds = inViewVariants.map((variant) => variant.id)
  const [optionLabels, inventoryLinks] = await Promise.all([
    productService.listVariantOptionLabels(inViewVariantIds),
    linkService.repo('productVariantInventoryItem').findByVariantIds(inViewVariantIds),
  ])
  const itemIds = [...new Set(inventoryLinks.map((link) => link.inventoryItemId))]
  // An empty filter array would reach the query builder as `inArray(column, [])`.
  const levels = itemIds.length > 0 ? await inventoryService.listInventoryLevels({ inventoryItemId: itemIds }) : []
  const stockOf = variantStockProjection(
    inventoryLinks,
    buildAvailableQuantities(levels),
    store?.lowStockThreshold ?? null,
  )
  const inStockVariantIds = new Set(
    inViewVariants.filter((variant) => isPurchasable(stockOf(variant))).map((variant) => variant.id),
  )

  return {
    status: 200,
    json: {
      filters: buildStoreProductFilters(
        filters,
        optionLabels.filter((label) => inStockVariantIds.has(label.variantId)),
        {
          namedFieldKeys: new Set(
            definitions.filter((definition) => definition.source !== 'vendor').map((definition) => definition.key),
          ),
          categories,
          colorFilterKey: COLOR_FILTER_KEY,
        },
      ),
      priceBounds: buildPriceBounds(inViewVariants, priceByVariantId),
    },
  }
}
