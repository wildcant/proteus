import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as orderByIdRoutes from './[id]/route.js'
import * as orderRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/store/orders',
    handler: orderRoutes.GET,
    throws: orderRoutes.GetThrows,
    input: orderRoutes.GetInput,
    operationId: 'listStoreOrders',
    summary: 'List customer orders',
    tags: [Tags.ORDERS],
    output: orderRoutes.GetOutput,
  },
  {
    method: 'GET',
    matcher: '/store/orders/:id',
    handler: orderByIdRoutes.GET,
    throws: orderByIdRoutes.GetThrows,
    input: orderByIdRoutes.GetInput,
    auth: 'optional',
    operationId: 'getStoreOrder',
    summary: 'Retrieve a customer order',
    tags: [Tags.ORDERS],
    output: orderByIdRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
