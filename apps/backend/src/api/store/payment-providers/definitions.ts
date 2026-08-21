import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as paymentProviderRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/store/payment-providers',
    handler: paymentProviderRoutes.GET,
    auth: 'optional',
    operationId: 'listStorePaymentProviders',
    summary: 'List enabled payment providers',
    tags: [Tags.PAYMENTS],
    output: paymentProviderRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
