import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import { setPricingContext } from '../middlewares.js'
import * as completeRoutes from './[id]/complete/route.js'
import * as inventoryRoutes from './[id]/inventory/route.js'
import * as lineItemByIdRoutes from './[id]/line-items/[lineId]/route.js'
import * as lineItemRoutes from './[id]/line-items/route.js'
import * as cartByIdRoutes from './[id]/route.js'
import * as shippingMethodRoutes from './[id]/shipping-methods/route.js'
import * as shippingOptionRoutes from './[id]/shipping-options/route.js'
import * as cartRoutes from './route.js'

export default [
  {
    method: 'POST',
    matcher: '/store/carts',
    handler: cartRoutes.POST,
    middlewares: [setPricingContext()],
    input: cartRoutes.PostInput,
    operationId: 'createStoreCart',
    summary: 'Create a cart',
    tags: [Tags.CARTS],
    output: cartRoutes.PostOutput,
  },
  {
    method: 'GET',
    matcher: '/store/carts/:id',
    handler: cartByIdRoutes.GET,
    input: cartByIdRoutes.GetInput,
    operationId: 'getStoreCart',
    summary: 'Retrieve a cart with line items',
    tags: [Tags.CARTS],
    output: cartByIdRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/store/carts/:id',
    handler: cartByIdRoutes.POST,
    input: cartByIdRoutes.PostInput,
    operationId: 'updateStoreCart',
    summary: 'Update a cart',
    tags: [Tags.CARTS],
    output: cartByIdRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/store/carts/:id/line-items',
    handler: lineItemRoutes.POST,
    input: lineItemRoutes.PostInput,
    operationId: 'addStoreCartLineItem',
    summary: 'Add a line item to a cart',
    tags: [Tags.CARTS],
    output: lineItemRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/store/carts/:id/line-items/:lineId',
    handler: lineItemByIdRoutes.POST,
    input: lineItemByIdRoutes.PostInput,
    operationId: 'updateStoreCartLineItem',
    summary: 'Update a cart line item',
    tags: [Tags.CARTS],
    output: lineItemByIdRoutes.PostOutput,
  },
  {
    method: 'DELETE',
    matcher: '/store/carts/:id/line-items/:lineId',
    handler: lineItemByIdRoutes.DELETE,
    input: lineItemByIdRoutes.DeleteInput,
    operationId: 'deleteStoreCartLineItem',
    summary: 'Remove a line item from a cart',
    tags: [Tags.CARTS],
    output: lineItemByIdRoutes.DeleteOutput,
  },
  {
    method: 'GET',
    matcher: '/store/carts/:id/shipping-options',
    handler: shippingOptionRoutes.GET,
    input: shippingOptionRoutes.GetInput,
    operationId: 'listStoreCartShippingOptions',
    summary: 'List available shipping options for a cart',
    tags: [Tags.CARTS],
    output: shippingOptionRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/store/carts/:id/shipping-methods',
    handler: shippingMethodRoutes.POST,
    input: shippingMethodRoutes.PostInput,
    operationId: 'addStoreCartShippingMethod',
    summary: 'Select a shipping method for a cart',
    tags: [Tags.CARTS],
    output: shippingMethodRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/store/carts/:id/complete',
    handler: completeRoutes.POST,
    input: completeRoutes.PostInput,
    operationId: 'completeStoreCart',
    summary: 'Complete a cart (authorize payment and mark as completed)',
    tags: [Tags.CARTS],
    output: completeRoutes.PostOutput,
  },
  {
    method: 'GET',
    matcher: '/store/carts/:id/inventory',
    handler: inventoryRoutes.GET,
    input: inventoryRoutes.GetInput,
    operationId: 'checkStoreCartInventory',
    summary: 'Check inventory availability for a cart',
    tags: [Tags.CARTS],
    output: inventoryRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
