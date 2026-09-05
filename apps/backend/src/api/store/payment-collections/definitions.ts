import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as paymentSessionUpdateRoutes from './[id]/payment-sessions/[sessionId]/route.js'
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
  {
    method: 'PATCH',
    matcher: '/store/payment-collections/:id/payment-sessions/:sessionId',
    handler: paymentSessionUpdateRoutes.PATCH,
    auth: 'optional',
    input: paymentSessionUpdateRoutes.PatchInput,
    operationId: 'updateStorePaymentSession',
    summary: "Re-price a payment session from the cart's server-side total",
    tags: [Tags.PAYMENT_COLLECTIONS],
    output: paymentSessionUpdateRoutes.PatchOutput,
  },
] satisfies RouteDefinition[]
