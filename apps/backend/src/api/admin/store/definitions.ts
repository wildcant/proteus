import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as storeRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/store',
    handler: storeRoutes.GET,
    operationId: 'getStore',
    summary: 'Retrieve the store and its currencies',
    tags: [Tags.STORE],
    throws: storeRoutes.GetThrows,
    output: storeRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
