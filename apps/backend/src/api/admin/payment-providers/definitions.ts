import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as paymentProviderRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/payment-providers',
    handler: paymentProviderRoutes.GET,
    operationId: 'listPaymentProviders',
    summary: 'List enabled payment providers',
    tags: [Tags.PAYMENT_PROVIDERS],
    output: paymentProviderRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
