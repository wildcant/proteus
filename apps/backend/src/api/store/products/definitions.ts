import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as productByHandleRoutes from './[handle]/route.js'
import * as productRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/store/products',
    handler: productRoutes.GET,
    auth: 'public',
    middlewares: productRoutes.GetMiddlewares,
    input: productRoutes.GetInput,
    operationId: 'listStoreProducts',
    summary: 'List published products',
    tags: [Tags.PRODUCTS],
    output: productRoutes.GetOutput,
  },
  {
    method: 'GET',
    matcher: '/store/products/:handle',
    handler: productByHandleRoutes.GET,
    throws: productByHandleRoutes.GetThrows,
    auth: 'public',
    middlewares: productByHandleRoutes.GetMiddlewares,
    input: productByHandleRoutes.GetInput,
    operationId: 'getStoreProduct',
    summary: 'Retrieve a product with variants',
    tags: [Tags.PRODUCTS],
    output: productByHandleRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
