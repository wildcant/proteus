import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as captureRoutes from './[id]/capture/route.js'
import * as refundRoutes from './[id]/refund/route.js'
import * as paymentByIdRoutes from './[id]/route.js'
import * as paymentProviderRoutes from './payment-providers/route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/payments/:id',
    handler: paymentByIdRoutes.GET,
    input: paymentByIdRoutes.GetInput,
    operationId: 'getPayment',
    summary: 'Retrieve a payment',
    tags: [Tags.PAYMENTS],
    output: paymentByIdRoutes.GetOutput,
  },
  {
    method: 'GET',
    matcher: '/admin/payments/payment-providers',
    handler: paymentProviderRoutes.GET,
    operationId: 'listAdminPaymentProviders',
    summary: 'List payment providers',
    tags: [Tags.PAYMENTS],
    output: paymentProviderRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/payments/:id/capture',
    handler: captureRoutes.POST,
    input: captureRoutes.PostInput,
    operationId: 'capturePayment',
    summary: 'Capture a payment',
    tags: [Tags.PAYMENTS],
    output: captureRoutes.PostOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/payments/:id/refund',
    handler: refundRoutes.POST,
    input: refundRoutes.PostInput,
    operationId: 'refundPayment',
    summary: 'Refund a payment',
    tags: [Tags.PAYMENTS],
    output: refundRoutes.PostOutput,
  },
] satisfies RouteDefinition[]
