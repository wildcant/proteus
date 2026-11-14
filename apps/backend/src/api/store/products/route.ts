import type { FilterableProductProps } from '@core/types/product/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  StorePricingContextParams,
  StoreProductListParams,
  StoreProductListResponse,
} from '@proteus/http-schemas/store'
import {
  buildListingAvailability,
  buildListingBadges,
  buildListingGroups,
  buildVariantImageUrls,
} from '@workflows/product/utils/build-listing-card.js'
import { buildStoreGroupingFilters } from '@workflows/product/utils/build-store-grouping-filters.js'
import { buildVariantPrices } from '@workflows/product/utils/build-variant-prices.js'
import {
  buildAvailableQuantities,
  isPurchasable,
  variantStockProjection,
} from '@workflows/product/utils/build-variant-stock.js'
import { setPricingContext } from '../middlewares.js'

export const GetInput = { query: StoreProductListParams, contextQuery: StorePricingContextParams }
export const GetMiddlewares = [setPricingContext()] as const
export const GetOutput = StoreProductListResponse

export const GET = async (
  req: HttpRequest<typeof GetInput, typeof GetMiddlewares>,
): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const pricingService = req.scope.resolve(Modules.PRICING)
  const inventoryService = req.scope.resolve(Modules.INVENTORY)
  const storeService = req.scope.resolve(Modules.STORE)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const listing = linkService.repo('storeCatalogListing')

  const { pagination, filters, q, order = 'relevance' } = req.validatedQuery
  const { offset, limit } = pagination
  const { category, collection, tag, filter, minPrice, maxPrice, exact, ...columnFilters } = filters
  const { currencyCode } = req.pricingContext

  const products: FilterableProductProps = {
    ...columnFilters,
    ...buildStoreGroupingFilters({ category, collection, tag, filter }),
  }
  const priceRange = { minPrice, maxPrice }
  // Filtered, sorted, paged and counted in one query: price and stock are no product column, and
  // reading the catalogue to page it in memory is what this replaced.
  const listPage = (search: string | undefined) =>
    listing.listStoreProducts({ currencyCode, products, search, priceRange, sort: order, limit, offset })

  // A search that matches nothing is run again as its closest spelling, when the titles and brands in
  // view hold one, so a typo lands on results rather than on an empty page — unless the shopper asked
  // for `q` as written.
  const asked = await listPage(q)
  const correctedQuery =
    q && !exact && asked.count === 0
      ? await productService.correctProductSearch(q, {
          ...products,
          status: 'published',
          sellableProductIds: listing.sellableProductIds({ currencyCode, priceRange }),
        })
      : null
  const { rows, count } = correctedQuery ? await listPage(correctedQuery) : asked
  if (rows.length === 0) return { status: 200, json: { products: [], count, offset, limit, correctedQuery } }

  // The card details, for the page alone: the products in the listing's order, the starting price
  // each one's cheapest variant quotes, and the page's variants and options for its groups,
  // availability and badges.
  const pageIds = rows.map((row) => row.productId)
  const [pageProducts, startingPrices, pageVariants, groupingsByProductId, listingOptions] = await Promise.all([
    productService.listProducts({ id: pageIds }),
    pricingService.calculatePrices(
      rows.map((row) => row.startingPriceSetId),
      req.pricingContext,
    ),
    productService.listProductVariants({ productId: pageIds }),
    productService.listProductGroupings(pageIds),
    productService.listProductListingOptions(pageIds),
  ])
  const productById = new Map(pageProducts.map((product) => [product.id, product]))
  const priceBySetId = new Map(startingPrices.map((price) => [price.id, price]))

  /**
   * A group or availability value counts only through a variant this market prices, the same set the product
   * page offers, and is in stock only through one a shopper can buy now: the listing answers both
   * at the product's grain, the card needs them per variant.
   */
  const pageVariantIds = pageVariants.map((variant) => variant.id)
  const [priceLinks, inventoryLinks, optionLabels, variantImages, store] = await Promise.all([
    linkService.repo('productVariantPriceSet').findByVariantIds(pageVariantIds),
    linkService.repo('productVariantInventoryItem').findByVariantIds(pageVariantIds),
    productService.listVariantOptionLabels(pageVariantIds),
    // An empty filter array would reach the query builder as `inArray(column, [])`.
    pageVariantIds.length > 0 ? productService.listProductVariantImages({ variantId: pageVariantIds }) : [],
    storeService.resolveStore(),
  ])
  const itemIds = [...new Set(inventoryLinks.map((link) => link.inventoryItemId))]
  const imageIds = [...new Set(variantImages.map((link) => link.imageId))]
  const [variantPrices, levels, images] = await Promise.all([
    pricingService.calculatePrices([...new Set(priceLinks.map((link) => link.priceSetId))], req.pricingContext),
    itemIds.length > 0 ? inventoryService.listInventoryLevels({ inventoryItemId: itemIds }) : [],
    imageIds.length > 0 ? productService.listProductImages({ id: imageIds }) : [],
  ])
  const priceByVariantId = buildVariantPrices(priceLinks, variantPrices)
  const stockOf = variantStockProjection(
    inventoryLinks,
    buildAvailableQuantities(levels),
    store?.lowStockThreshold ?? null,
  )

  const pricedVariants = pageVariants.filter((variant) => priceByVariantId.has(variant.id))
  const purchasableVariants = pricedVariants.filter((variant) => isPurchasable(stockOf(variant)))
  const purchasableVariantIds = new Set(purchasableVariants.map((variant) => variant.id))
  const groupsByProductId = buildListingGroups(pricedVariants, optionLabels, {
    listingOptions,
    imageUrlByVariantId: buildVariantImageUrls(variantImages, images),
    purchasableVariantIds,
  })
  const availableByProductId = buildListingAvailability(purchasableVariants, optionLabels, listingOptions)

  const listed = rows.flatMap((row) => {
    const product = productById.get(row.productId)
    if (!product) return []
    return [
      {
        ...product,
        startingPrice: priceBySetId.get(row.startingPriceSetId),
        soldOut: !row.purchasable,
        badges: buildListingBadges(groupingsByProductId[product.id]?.collections ?? []),
        groups: groupsByProductId.get(product.id) ?? null,
        available: availableByProductId.get(product.id) ?? null,
      },
    ]
  })

  return { status: 200, json: { products: listed, count, offset, limit, correctedQuery } }
}
