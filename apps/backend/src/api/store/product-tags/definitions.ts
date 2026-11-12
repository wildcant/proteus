import type { ProductDTO } from '@core/types/product/common.js'
import type { RouteDefinition } from '@framework/http/types.js'
import { searchable, Tags } from '@framework/http/types.js'
import * as productTagRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/store/product-tags',
    handler: productTagRoutes.GET,
    auth: 'public',
    middlewares: productTagRoutes.GetMiddlewares,
    input: productTagRoutes.GetInput,
    // The product list's own search, so `q` scopes the values exactly as it scopes the list.
    searchableColumns: searchable<ProductDTO>('title'),
    operationId: 'listStoreProductTagValues',
    summary: 'List the Tag values on the products in view',
    tags: [Tags.PRODUCT_TAGS],
    output: productTagRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
