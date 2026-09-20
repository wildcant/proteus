import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as markAsPaidRoutes from './[id]/mark-as-paid/route.js'
import * as paymentCollectionByIdRoutes from './[id]/route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/payment-collections/:id',
    handler: paymentCollectionByIdRoutes.GET,
    input: paymentCollectionByIdRoutes.GetInput,
    operationId: 'getPaymentCollection',
    summary: 'Retrieve a payment collection',
    tags: [Tags.PAYMENT_COLLECTIONS],
    output: paymentCollectionByIdRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/payment-collections/:id/mark-as-paid',
    handler: markAsPaidRoutes.POST,
    input: markAsPaidRoutes.PostInput,
    operationId: 'markPaymentCollectionAsPaid',
    summary: 'Mark a payment collection as paid',
    tags: [Tags.PAYMENT_COLLECTIONS],
    output: markAsPaidRoutes.PostOutput,
  },
] satisfies RouteDefinition[]
