import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as paymentSessionRoutes from './[id]/payment-sessions/route.js'
import * as paymentCollectionRoutes from './route.js'

export default [
  {
    method: 'POST',
    matcher: '/store/payment-collections',
    handler: paymentCollectionRoutes.POST,
    auth: 'optional',
    input: paymentCollectionRoutes.PostInput,
    operationId: 'createStorePaymentCollection',
    summary: 'Create a payment collection for a cart',
    tags: [Tags.PAYMENT_COLLECTIONS],
    output: paymentCollectionRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/store/payment-collections/:id/payment-sessions',
    handler: paymentSessionRoutes.POST,
    auth: 'optional',
    input: paymentSessionRoutes.PostInput,
    operationId: 'createStorePaymentSession',
    summary: 'Create a payment session',
    tags: [Tags.PAYMENT_COLLECTIONS],
    output: paymentSessionRoutes.PostOutput,
  },
] satisfies RouteDefinition[]
