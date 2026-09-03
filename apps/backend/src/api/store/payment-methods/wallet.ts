import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { CustomerDTO, ICustomerModuleService, IPaymentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import type { HttpRequest } from '../../../server/ports.js'

/**
 * Who is asking, and whether they have an account at all.
 *
 * The distinction these routes turn on is not "is there a Customer row" — Proteus writes one for
 * every guest checkout, with `hasAccount: false` — but whether that row is an *account*. A guest
 * must leave nothing at a gateway, so gating on the record rather than the account would give
 * every guest a Stripe Customer.
 */
export async function requestingCustomer(req: HttpRequest): Promise<CustomerDTO> {
  const customerId = req.authContext?.actorId
  if (!customerId) {
    throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Not authenticated' })
  }

  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER)
  return customerService.retrieveCustomer(customerId)
}

/**
 * The account holder for each provider that has the concept, created here on first need.
 *
 * This is "reaching the payment step" as far as a gateway is concerned: the storefront fetches
 * the wallet before it can render the selector, and an authenticated shopper with an empty wallet
 * still needs somewhere for their first card to land.
 *
 * Trimmed to `{ id, externalId }` when it travels into a payment session, because a session's
 * context is persisted and served back to the browser — see the payment-sessions route.
 */
export async function ensureAccountHolders(req: HttpRequest, customer: CustomerDTO) {
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)

  if (!customer.hasAccount) return []

  return paymentService.ensureAccountHolders({
    customerId: customer.id,
    email: customer.email,
    name: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || null,
  })
}
