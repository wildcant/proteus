import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as categoryRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/store/product-categories',
    handler: categoryRoutes.GET,
    auth: 'public',
    operationId: 'listStoreProductCategoryTree',
    summary: 'List the Visible Category tree',
    tags: [Tags.PRODUCT_CATEGORIES],
    output: categoryRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
