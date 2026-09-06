import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { CustomerDTO, ICustomerModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import type { MiddlewareFunction } from '@framework/http/types.js'

/**
 * The currency and customer context prices are calculated in.
 *
 * Declared rather than assumed: a route that reads `req.pricingContext` without this middleware in
 * its list no longer compiles, which is what retired the three hand-written
 * "pricingContext missing" guards this used to rely on.
 */
export function setPricingContext(): MiddlewareFunction<{ pricingContext: { currencyCode: string } }> {
  return (req) => ({
    // TODO(pricing): resolve currency from region_id query param or cart
    // TODO(pricing): resolve customer groups for context-based pricing
    ...req,
    pricingContext: { currencyCode: 'usd' },
  })
}

/**
 * Loads the Customer row behind the caller's token, or refuses the request.
 *
 * The guard is on the token, not on the row: `retrieveCustomer` is `findByIdOrFail`, so a token
 * naming a customer that no longer exists 404s on its own and never reaches here as `undefined`.
 *
 * On an `auth: 'required'` route the 401 is unreachable — the auth policy has already rejected an
 * anonymous caller. It is here because it is the runtime witness for the non-optional
 * `{ customer: CustomerDTO }` this declares: without a narrow the type would be an assertion, and
 * it stays true if the route's policy is ever relaxed to `'optional'`.
 *
 * Note the distinction this does *not* draw: `hasAccount`. Proteus writes a Customer row for every
 * guest checkout, so a row is not an account. A route that must not touch a gateway on a guest's
 * behalf checks `customer.hasAccount` itself.
 */
export function requireCustomer(): MiddlewareFunction<{ customer: CustomerDTO }> {
  return async (req) => {
    const customerId = req.authContext?.actorId
    if (!customerId) {
      throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Not authenticated' })
    }

    const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
    return { ...req, customer: await customerService.retrieveCustomer(customerId) }
  }
}

/**
 * Loads the Customer row when the caller has a token, and lets a guest through.
 *
 * For `auth: 'optional'` routes, where a guest is a legitimate caller — a shopper pressing Place
 * order without an account still needs a payment session. The handler narrows, and that narrow is
 * where the route says what a guest gets.
 */
export function attachCustomer(): MiddlewareFunction<{ customer?: CustomerDTO }> {
  return async (req) => {
    const customerId = req.authContext?.actorId
    if (!customerId) return req

    const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
    return { ...req, customer: await customerService.retrieveCustomer(customerId) }
  }
}
