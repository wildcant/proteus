import type { FilterableProductProps } from '@core/types/product/common.js'
import { buildSearchFilter, PRODUCT_SEARCH_COLUMNS } from '@core/utils/build-search-filter.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  StorePricingContextParams,
  StoreProductFilterListParams,
  StoreProductFilterListResponse,
} from '@proteus/http-schemas/store'
import { buildStoreGroupingFilters } from '@workflows/product/utils/build-store-grouping-filters.js'
import { productsPricedWithin } from '@workflows/product/utils/products-priced-within.js'
import { listSellableProducts, setPricingContext } from '../middlewares.js'

export const GetInput = { query: StoreProductFilterListParams, contextQuery: StorePricingContextParams }
export const GetMiddlewares = [setPricingContext()] as const
export const GetOutput = StoreProductFilterListResponse

export const GET = async (
  req: HttpRequest<typeof GetInput, typeof GetMiddlewares>,
): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const { filters, q } = req.validatedQuery
  const { category, collection, tag, filter, minPrice, maxPrice, exact, ...columnFilters } = filters
  const { productIds, variants, priceByVariantId } = await listSellableProducts(req.scope, req.pricingContext)
  // The price range is a selection like the others: it moves the counts, so a range that keeps
  // nothing leaves every filter in place at 0 rather than taking them away.
  const hasPriceRange = minPrice !== undefined || maxPrice !== undefined
  const pricedProductIds = hasPriceRange
    ? productsPricedWithin(variants, priceByVariantId, { minPrice, maxPrice })
    : undefined

  // An empty filter array would reach the query builder as `inArray(column, [])`.
  if (productIds.length === 0) return { status: 200, json: { filters: [], correctedQuery: null } }

  // The same filters `GET /store/products` builds, so a count is the size of the list the value leads to.
  const selected: FilterableProductProps = {
    ...columnFilters,
    ...buildStoreGroupingFilters({ category, collection, tag, filter }),
    status: 'published',
    id: productIds,
    pricedProductIds,
  }

  // Corrected exactly when the list corrects — `q`, not asked for as written, matching nothing under
  // the same selections — so the counts describe the products the list then shows.
  const [asked] =
    q && !exact
      ? await productService.listProducts(
          { ...selected, ...buildSearchFilter(q, PRODUCT_SEARCH_COLUMNS) },
          { select: ['id'], limit: 1 },
        )
      : []
  const correctedQuery = q && !exact && !asked ? await productService.correctProductSearch(q, selected) : null
  const search = correctedQuery ?? q
  const productFilters = await productService.listProductFilters({
    ...selected,
    ...(search ? buildSearchFilter(search, PRODUCT_SEARCH_COLUMNS) : {}),
  })
  return { status: 200, json: { filters: productFilters, correctedQuery } }
}
