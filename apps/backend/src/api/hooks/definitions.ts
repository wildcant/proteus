import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as paymentWebhookRoutes from './payment/[provider]/route.js'

export default [
  {
    method: 'POST',
    matcher: '/hooks/payment/:provider',
    handler: paymentWebhookRoutes.POST,
    throws: paymentWebhookRoutes.PostThrows,
    input: paymentWebhookRoutes.PostInput,
    operationId: 'paymentWebhook',
    summary: 'Handle payment provider webhook',
    tags: [Tags.WEBHOOKS],
    output: paymentWebhookRoutes.PostOutput,
  },
] satisfies RouteDefinition[]
