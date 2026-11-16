import type { FilterableProductProps } from '@core/types/product/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { DEFAULT_RELATED_MATCH } from '@core/utils/related-match.js'
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
  findActiveGroupValue,
} from '@workflows/product/utils/build-listing-card.js'
import { buildListingSublines } from '@workflows/product/utils/build-listing-subline.js'
import { buildStoreGroupingFilters, selectsSale } from '@workflows/product/utils/build-store-grouping-filters.js'
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
  const { category, collection, tag, filter, minPrice, maxPrice, exact, similarTo, available, ...columnFilters } =
    filters
  const { currencyCode } = req.pricingContext

  const products: FilterableProductProps = {
    ...columnFilters,
    ...buildStoreGroupingFilters({ category, collection, tag, filter }),
  }
  const priceRange = { minPrice, maxPrice }
  const onSale = selectsSale(filter)
  // What the store relates products by, read up front only when the list ranks by likeness.
  const related = similarTo ? ((await storeService.resolveStore())?.related ?? DEFAULT_RELATED_MATCH) : null
  // Filtered, sorted, paged and counted in one query: price and stock are no product column, and
  // reading the catalogue to page it in memory is what this replaced.
  const listPage = (search: string | undefined) =>
    listing.listStoreProducts({
      currencyCode,
      products,
      search,
      priceRange,
      onSale,
      sort: order,
      limit,
      offset,
      similarTo: similarTo && related ? { handle: similarTo, match: related } : undefined,
      purchasableOnly: available,
    })

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
          selectedProductIds: listing.selectedProductIds({ currencyCode, onSale }),
        })
      : null
  const { rows, count } = correctedQuery ? await listPage(correctedQuery) : asked
  if (rows.length === 0) return { status: 200, json: { products: [], count, offset, limit, correctedQuery } }

  // The card details, for the page alone: the products in the listing's order, the starting price
  // each one's cheapest variant quotes, and the page's variants and options for its groups,
  // availability and badges.
  const pageIds = rows.map((row) => row.productId)
  const [pageProducts, startingPrices, pageVariants, groupingsByProductId, listingOptions, store] = await Promise.all([
    productService.listProducts({ id: pageIds }),
    pricingService.calculatePrices(
      rows.map((row) => row.startingPriceSetId),
      req.pricingContext,
    ),
    productService.listProductVariants({ productId: pageIds }),
    productService.listProductGroupings(pageIds),
    productService.listProductListingOptions(pageIds),
    storeService.resolveStore(),
  ])
  const productById = new Map(pageProducts.map((product) => [product.id, product]))
  const priceBySetId = new Map(startingPrices.map((price) => [price.id, price]))

  /**
   * A group or availability value counts only through a variant this market prices, the same set the product
   * page offers, and is in stock only through one a shopper can buy now: the listing answers both
   * at the product's grain, the card needs them per variant.
   */
  const pageVariantIds = pageVariants.map((variant) => variant.id)
  // The subline's fields, for the page in one read, only when the store has a subline at all.
  const card = store?.card ?? { subline: null, listSeparator: ', ' }
  const [priceLinks, inventoryLinks, optionLabels, variantImages, fieldValuesByProductId, categories] =
    await Promise.all([
      linkService.repo('productVariantPriceSet').findByVariantIds(pageVariantIds),
      linkService.repo('productVariantInventoryItem').findByVariantIds(pageVariantIds),
      productService.listVariantOptionLabels(pageVariantIds),
      // An empty filter array would reach the query builder as `inArray(column, [])`.
      pageVariantIds.length > 0 ? productService.listProductVariantImages({ variantId: pageVariantIds }) : [],
      card.subline ? productService.listFieldValuesOfProducts(pageIds) : {},
      card.subline ? productService.listCategories() : [],
    ])
  const itemIds = [...new Set(inventoryLinks.map((link) => link.inventoryItemId))]
  const imageIds = [...new Set(variantImages.map((link) => link.imageId))]
  const [variantPrices, levels, images] = await Promise.all([
    pricingService.calculatePrices([...new Set(priceLinks.map((link) => link.priceSetId))], req.pricingContext),
    itemIds.length > 0 ? inventoryService.listInventoryLevels({ inventoryItemId: itemIds }) : [],
    imageIds.length > 0 ? productService.listProductImages({ id: imageIds }) : [],
  ])
  const priceByVariantId = buildVariantPrices(priceLinks, variantPrices)
  /**
   * The sale variant's quote, which carries its compare-at: the listing picked it for being marked down. Its
   * variant rides along so the card opens on the variant the sale is.
   */
  const salePriceOf = (variantId: string | null) => {
    const price = variantId === null ? undefined : priceByVariantId.get(variantId)
    return variantId && price?.compareAtAmount ? { ...price, compareAtAmount: price.compareAtAmount, variantId } : null
  }
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
  const sublineByProductId = buildListingSublines(pageProducts, {
    card,
    typeByProductId: new Map(
      Object.entries(groupingsByProductId).flatMap(([id, groupings]) =>
        groupings.type ? [[id, groupings.type.value]] : [],
      ),
    ),
    fieldValuesByProductId,
    categories,
  })

  const listed = rows.flatMap((row) => {
    const product = productById.get(row.productId)
    if (!product) return []
    const groups = groupsByProductId.get(product.id) ?? null
    // A filter on the grouping option opens the card on the colourway it chose, photo and all.
    const activeGroupValue = findActiveGroupValue(groups, products.optionValues)
    return [
      {
        ...product,
        thumbnail: activeGroupValue?.thumbnail ?? product.thumbnail,
        startingPrice: priceBySetId.get(row.startingPriceSetId),
        salePrice: salePriceOf(row.saleVariantId),
        soldOut: !row.purchasable,
        badges: buildListingBadges(groupingsByProductId[product.id]?.collections ?? []),
        groups,
        activeGroupValue: activeGroupValue?.value ?? null,
        available: availableByProductId.get(product.id) ?? null,
        subline: sublineByProductId.get(product.id) ?? null,
      },
    ]
  })

  return { status: 200, json: { products: listed, count, offset, limit, correctedQuery } }
}
