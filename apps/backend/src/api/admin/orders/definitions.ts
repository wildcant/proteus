import type { RouteDefinition } from '@framework/http/types.js'
import { searchable, Tags } from '@framework/http/types.js'
import type { OrderDTO } from '../../../core/types/order/common.js'
import * as archiveRoutes from './[id]/archive/route.js'
import * as cancelRoutes from './[id]/cancel/route.js'
import * as completeRoutes from './[id]/complete/route.js'
import * as markAsDeliveredRoutes from './[id]/fulfillments/[fulfillmentId]/mark-as-delivered/route.js'
import * as shipmentRoutes from './[id]/fulfillments/[fulfillmentId]/shipments/route.js'
import * as fulfillmentRoutes from './[id]/fulfillments/route.js'
import * as orderByIdRoutes from './[id]/route.js'
import * as orderRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/orders',
    handler: orderRoutes.GET,
    input: orderRoutes.GetInput,
    searchableColumns: searchable<OrderDTO>('email'),
    operationId: 'listOrders',
    summary: 'List orders',
    tags: [Tags.ORDERS],
    output: orderRoutes.GetOutput,
  },
  {
    method: 'GET',
    matcher: '/admin/orders/:id',
    handler: orderByIdRoutes.GET,
    input: orderByIdRoutes.GetInput,
    operationId: 'getOrder',
    summary: 'Retrieve an order',
    tags: [Tags.ORDERS],
    output: orderByIdRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/orders/:id/complete',
    handler: completeRoutes.POST,
    input: completeRoutes.PostInput,
    operationId: 'completeOrder',
    summary: 'Complete an order',
    tags: [Tags.ORDERS],
    output: completeRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/orders/:id/cancel',
    handler: cancelRoutes.POST,
    input: cancelRoutes.PostInput,
    operationId: 'cancelOrder',
    summary: 'Cancel an order',
    tags: [Tags.ORDERS],
    output: cancelRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/orders/:id/archive',
    handler: archiveRoutes.POST,
    input: archiveRoutes.PostInput,
    operationId: 'archiveOrder',
    summary: 'Archive an order',
    tags: [Tags.ORDERS],
    output: archiveRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/orders/:id/fulfillments',
    handler: fulfillmentRoutes.POST,
    input: fulfillmentRoutes.PostInput,
    operationId: 'createOrderFulfillment',
    summary: 'Create a fulfillment for an order',
    tags: [Tags.ORDERS],
    output: fulfillmentRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/orders/:id/fulfillments/:fulfillmentId/shipments',
    handler: shipmentRoutes.POST,
    input: shipmentRoutes.PostInput,
    operationId: 'createOrderShipment',
    summary: 'Create a shipment for a fulfillment',
    tags: [Tags.ORDERS],
    output: shipmentRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/orders/:id/fulfillments/:fulfillmentId/mark-as-delivered',
    handler: markAsDeliveredRoutes.POST,
    input: markAsDeliveredRoutes.PostInput,
    operationId: 'markOrderAsDelivered',
    summary: 'Mark a fulfillment as delivered',
    tags: [Tags.ORDERS],
    output: markAsDeliveredRoutes.PostOutput,
  },
] satisfies RouteDefinition[]
