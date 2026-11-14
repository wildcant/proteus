import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  StorePricingContextParams,
  StoreProductTagValueListParams,
  StoreProductTagValueListResponse,
} from '@proteus/http-schemas/store'
import { buildStoreGroupingFilters } from '@workflows/product/utils/build-store-grouping-filters.js'
import { setPricingContext } from '../middlewares.js'

export const GetInput = { query: StoreProductTagValueListParams, contextQuery: StorePricingContextParams }
export const GetMiddlewares = [setPricingContext()] as const
export const GetOutput = StoreProductTagValueListResponse

export const GET = async (
  req: HttpRequest<typeof GetInput, typeof GetMiddlewares>,
): Promise<HttpResult<typeof GetOutput>> => {
  const productService = req.scope.resolve(Modules.PRODUCT)
  const { category, collection, ...columnFilters } = req.validatedQuery.filters
  const listing = req.scope.resolve(ContainerRegistrationKeys.LINK).repo('storeCatalogListing')

  // The same filters `GET /store/products` builds, so a chip never offers a value its list cannot show.
  const values = await productService.listProductTagValues({
    ...columnFilters,
    ...buildStoreGroupingFilters({ category, collection }),
    status: 'published',
    sellableProductIds: listing.sellableProductIds({ currencyCode: req.pricingContext.currencyCode }),
  })
  return { status: 200, json: { values } }
}
