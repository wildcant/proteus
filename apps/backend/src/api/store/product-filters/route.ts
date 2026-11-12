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
  const { category, collection, tag, filter, minPrice, maxPrice, ...columnFilters } = req.validatedQuery.filters
  const { variants, priceByVariantId } = await listSellableProducts(req.scope, req.pricingContext)
  // The price range scopes the filters the way it scopes the list, so a count is never one the list
  // cannot reach.
  const productIds = productsPricedWithin(variants, priceByVariantId, { minPrice, maxPrice })

  // An empty filter array would reach the query builder as `inArray(column, [])`.
  if (productIds.length === 0) return { status: 200, json: { filters: [] } }

  // The same filters `GET /store/products` builds, so a count is the size of the list the value leads to.
  const filters = await productService.listProductFilters({
    ...columnFilters,
    ...buildStoreGroupingFilters({ category, collection, tag, filter }),
    status: 'published',
    id: productIds,
  })
  return { status: 200, json: { filters } }
}
