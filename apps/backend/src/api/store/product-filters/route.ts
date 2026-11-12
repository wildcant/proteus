import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  StorePricingContextParams,
  StoreProductFilterListParams,
  StoreProductFilterListResponse,
} from '@proteus/http-schemas/store'
import { buildStoreGroupingFilters } from '@workflows/product/utils/build-store-grouping-filters.js'
import { listSellableProducts, setPricingContext } from '../middlewares.js'

export const GetInput = { query: StoreProductFilterListParams, contextQuery: StorePricingContextParams }
export const GetMiddlewares = [setPricingContext()] as const
export const GetOutput = StoreProductFilterListResponse

export const GET = async (
  req: HttpRequest<typeof GetInput, typeof GetMiddlewares>,
): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const { category, collection, tag, filter, ...columnFilters } = req.validatedQuery.filters
  const { productIds } = await listSellableProducts(req.scope, req.pricingContext)

  // An empty filter array would reach the query builder as `inArray(column, [])`.
  if (productIds.length === 0) return { status: 200, json: { filters: [] } }

  // The same filters `GET /store/products` builds, so a count is the size of the list the value leads to.
  const filters = await productService.listProductMetafieldFilters({
    ...columnFilters,
    ...buildStoreGroupingFilters({ category, collection, tag, filter }),
    status: 'published',
    id: productIds,
  })
  return { status: 200, json: { filters } }
}
