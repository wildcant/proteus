import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as fulfillmentProviderRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/fulfillment-providers',
    handler: fulfillmentProviderRoutes.GET,
    permissions: ['fulfillment.read'],
    operationId: 'listAdminFulfillmentProviders',
    summary: 'List fulfillment providers',
    tags: [Tags.FULFILLMENT_PROVIDERS],
    output: fulfillmentProviderRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
