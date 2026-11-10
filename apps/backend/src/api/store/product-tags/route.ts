import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  StorePricingContextParams,
  StoreProductTagValueListParams,
  StoreProductTagValueListResponse,
} from '@proteus/http-schemas/store'
import { buildStoreGroupingFilters } from '@workflows/product/utils/build-store-grouping-filters.js'
import { setPricingContext, setSellableProducts } from '../middlewares.js'

export const GetInput = { query: StoreProductTagValueListParams, contextQuery: StorePricingContextParams }
export const GetMiddlewares = [setPricingContext(), setSellableProducts()] as const
export const GetOutput = StoreProductTagValueListResponse

export const GET = async (
  req: HttpRequest<typeof GetInput, typeof GetMiddlewares>,
): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const { category, collection, ...columnFilters } = req.validatedQuery.filters
  const { productIds } = req.sellableProducts

  // An empty filter array would reach the query builder as `inArray(column, [])`.
  if (productIds.length === 0) return { status: 200, json: { values: [] } }

  // The same filters `GET /store/products` builds, so a chip never offers a value its list cannot show.
  const values = await productService.listProductTagValues({
    ...columnFilters,
    ...buildStoreGroupingFilters({ category, collection }),
    status: 'published',
    id: productIds,
  })
  return { status: 200, json: { values } }
}
