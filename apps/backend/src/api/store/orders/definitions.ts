import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as orderByIdRoutes from './[id]/route.js'
import * as lookupRoutes from './lookup/route.js'
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
    summary: 'Retrieve an order by its id',
    tags: [Tags.ORDERS],
    output: orderByIdRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/store/orders/lookup',
    handler: lookupRoutes.POST,
    throws: lookupRoutes.PostThrows,
    input: lookupRoutes.PostInput,
    auth: 'public',
    operationId: 'lookupStoreOrder',
    summary: 'Find an order by its number and phone digits',
    tags: [Tags.ORDERS],
    output: lookupRoutes.PostOutput,
  },
] satisfies RouteDefinition[]
