import type { FilterableProductProps } from '@core/types/product/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  StorePricingContextParams,
  StoreProductListParams,
  StoreProductListResponse,
} from '@proteus/http-schemas/store'
import { buildStoreGroupingFilters } from '@workflows/product/utils/build-store-grouping-filters.js'
import { setPricingContext } from '../middlewares.js'

export const GetInput = { query: StoreProductListParams, contextQuery: StorePricingContextParams }
export const GetMiddlewares = [setPricingContext()] as const
export const GetOutput = StoreProductListResponse

export const GET = async (
  req: HttpRequest<typeof GetInput, typeof GetMiddlewares>,
): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const pricingService = req.scope.resolve(Modules.PRICING)
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

  // The card details, for the page alone: the products in the listing's order, and the starting price
  // each one's cheapest variant quotes.
  const [pageProducts, startingPrices] = await Promise.all([
    productService.listProducts({ id: rows.map((row) => row.productId) }),
    pricingService.calculatePrices(
      rows.map((row) => row.startingPriceSetId),
      req.pricingContext,
    ),
  ])
  const productById = new Map(pageProducts.map((product) => [product.id, product]))
  const priceBySetId = new Map(startingPrices.map((price) => [price.id, price]))

  const listed = rows.flatMap((row) => {
    const product = productById.get(row.productId)
    if (!product) return []
    return [{ ...product, startingPrice: priceBySetId.get(row.startingPriceSetId), soldOut: !row.purchasable }]
  })

  return { status: 200, json: { products: listed, count, offset, limit, correctedQuery } }
}
