import type { RouteDefinition } from '@framework/http/types.js'
import { searchable, Tags } from '@framework/http/types.js'
import type { ProductDTO } from '../../../core/types/product/common.js'
import * as productByIdRoutes from './[id]/route.js'
import { setPricingContext } from './middlewares.js'
import * as productRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/store/products',
    handler: productRoutes.GET,
    auth: 'public',
    input: productRoutes.GetInput,
    searchableColumns: searchable<ProductDTO>('title'),
    operationId: 'listStoreProducts',
    summary: 'List published products',
    tags: [Tags.PRODUCTS],
    output: productRoutes.GetOutput,
  },
  {
    method: 'GET',
    matcher: '/store/products/:id',
    handler: productByIdRoutes.GET,
    auth: 'public',
    middlewares: [setPricingContext()],
    input: productByIdRoutes.GetInput,
    operationId: 'getStoreProduct',
    summary: 'Retrieve a product with variants',
    tags: [Tags.PRODUCTS],
    output: productByIdRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
