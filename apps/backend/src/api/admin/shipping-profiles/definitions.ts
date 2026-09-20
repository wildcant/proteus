import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as shippingProfileByIdRoutes from './[id]/route.js'
import * as shippingProfileRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/shipping-profiles',
    handler: shippingProfileRoutes.GET,
    operationId: 'listAdminShippingProfiles',
    summary: 'List shipping profiles',
    tags: [Tags.SHIPPING_PROFILES],
    output: shippingProfileRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/shipping-profiles',
    handler: shippingProfileRoutes.POST,
    input: shippingProfileRoutes.PostInput,
    operationId: 'createAdminShippingProfile',
    summary: 'Create a shipping profile',
    tags: [Tags.SHIPPING_PROFILES],
    output: shippingProfileRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/shipping-profiles/:id',
    handler: shippingProfileByIdRoutes.POST,
    input: shippingProfileByIdRoutes.PostInput,
    operationId: 'updateAdminShippingProfile',
    summary: 'Update a shipping profile',
    tags: [Tags.SHIPPING_PROFILES],
    output: shippingProfileByIdRoutes.PostOutput,
  },
  {
    method: 'DELETE',
    matcher: '/admin/shipping-profiles/:id',
    handler: shippingProfileByIdRoutes.DELETE,
    input: shippingProfileByIdRoutes.DeleteInput,
    operationId: 'deleteAdminShippingProfile',
    summary: 'Delete a shipping profile',
    tags: [Tags.SHIPPING_PROFILES],
    output: shippingProfileByIdRoutes.DeleteOutput,
  },
] satisfies RouteDefinition[]
