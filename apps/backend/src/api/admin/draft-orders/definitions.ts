import type { RouteDefinition } from '@framework/http/types.js'
import { searchable, Tags } from '@framework/http/types.js'
import type { OrderDTO } from '../../../core/types/order/common.js'
import * as draftOrderRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/draft-orders',
    handler: draftOrderRoutes.GET,
    input: draftOrderRoutes.GetInput,
    searchableColumns: searchable<OrderDTO>('email'),
    permissions: ['order.read'],
    operationId: 'listDraftOrders',
    summary: 'List draft orders',
    tags: [Tags.ORDERS],
    output: draftOrderRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
