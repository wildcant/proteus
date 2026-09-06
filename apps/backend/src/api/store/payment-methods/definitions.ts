import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as defaultRoutes from './[id]/default/route.js'
import * as methodByIdRoutes from './[id]/route.js'
import * as methodRoutes from './route.js'

/**
 * The wallet, all three verbs authenticated.
 *
 * Creation is deliberately absent: a card is saved as a side effect of a payment the shopper
 * consented to save, never by posting one here. Adding a card outside a purchase means a
 * SetupIntent flow, which is its own feature.
 */
export default [
  {
    method: 'GET',
    matcher: '/store/payment-methods',
    handler: methodRoutes.GET,
    operationId: 'listStorePaymentMethods',
    summary: "List the authenticated customer's saved payment methods",
    middlewares: methodRoutes.GetMiddlewares,
    tags: [Tags.PAYMENTS],
    output: methodRoutes.GetOutput,
  },
  {
    method: 'DELETE',
    matcher: '/store/payment-methods/:id',
    handler: methodByIdRoutes.DELETE,
    input: methodByIdRoutes.DeleteInput,
    operationId: 'deleteStorePaymentMethod',
    summary: 'Remove a saved payment method',
    middlewares: methodByIdRoutes.DeleteMiddlewares,
    tags: [Tags.PAYMENTS],
    output: methodByIdRoutes.DeleteOutput,
  },
  {
    method: 'POST',
    matcher: '/store/payment-methods/:id/default',
    handler: defaultRoutes.POST,
    input: defaultRoutes.PostInput,
    operationId: 'setStoreDefaultPaymentMethod',
    summary: 'Nominate the default payment method',
    middlewares: defaultRoutes.PostMiddlewares,
    tags: [Tags.PAYMENTS],
    output: defaultRoutes.PostOutput,
  },
] satisfies RouteDefinition[]
