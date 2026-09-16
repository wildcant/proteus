import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as inventoryItemRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/inventory-items',
    handler: inventoryItemRoutes.GET,
    input: inventoryItemRoutes.GetInput,
    operationId: 'listInventoryItems',
    summary: 'List inventory items',
    tags: [Tags.INVENTORY],
    output: inventoryItemRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
