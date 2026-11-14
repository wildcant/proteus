import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as productFilterRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/store/product-filters',
    handler: productFilterRoutes.GET,
    auth: 'public',
    middlewares: productFilterRoutes.GetMiddlewares,
    input: productFilterRoutes.GetInput,
    operationId: 'listStoreProductFilters',
    summary: 'List the metafield filters over the products in view, with counts',
    tags: [Tags.PRODUCTS],
    output: productFilterRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
