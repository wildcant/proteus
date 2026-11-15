import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as paymentCollectionByIdRoutes from './[id]/route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/payment-collections/:id',
    handler: paymentCollectionByIdRoutes.GET,
    input: paymentCollectionByIdRoutes.GetInput,
    permissions: ['payment.read'],
    operationId: 'getPaymentCollection',
    summary: 'Retrieve a payment collection',
    tags: [Tags.PAYMENT_COLLECTIONS],
    output: paymentCollectionByIdRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
