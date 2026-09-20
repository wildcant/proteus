import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as shippingOptionByIdRoutes from './[id]/route.js'
import * as shippingOptionRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/shipping-options',
    handler: shippingOptionRoutes.GET,
    operationId: 'listAdminShippingOptions',
    summary: 'List shipping options',
    tags: [Tags.SHIPPING_OPTIONS],
    output: shippingOptionRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/shipping-options',
    handler: shippingOptionRoutes.POST,
    input: shippingOptionRoutes.PostInput,
    operationId: 'createAdminShippingOption',
    summary: 'Create a shipping option',
    tags: [Tags.SHIPPING_OPTIONS],
    output: shippingOptionRoutes.PostOutput,
  },
  {
    method: 'GET',
    matcher: '/admin/shipping-options/:id',
    handler: shippingOptionByIdRoutes.GET,
    input: shippingOptionByIdRoutes.GetInput,
    operationId: 'getAdminShippingOption',
    summary: 'Retrieve a shipping option',
    tags: [Tags.SHIPPING_OPTIONS],
    output: shippingOptionByIdRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/shipping-options/:id',
    handler: shippingOptionByIdRoutes.POST,
    input: shippingOptionByIdRoutes.PostInput,
    operationId: 'updateAdminShippingOption',
    summary: 'Update a shipping option',
    tags: [Tags.SHIPPING_OPTIONS],
    output: shippingOptionByIdRoutes.PostOutput,
  },
  {
    method: 'DELETE',
    matcher: '/admin/shipping-options/:id',
    handler: shippingOptionByIdRoutes.DELETE,
    input: shippingOptionByIdRoutes.DeleteInput,
    operationId: 'deleteAdminShippingOption',
    summary: 'Delete a shipping option',
    tags: [Tags.SHIPPING_OPTIONS],
    output: shippingOptionByIdRoutes.DeleteOutput,
  },
] satisfies RouteDefinition[]
