import type { CustomerDTO } from '@core/types/customer/common.js'
import type { EnsureAccountHoldersDTO } from '@core/types/payment/mutations.js'

/**
 * The customer as a gateway needs them described, ready for `ensureAccountHolders`.
 *
 * Two routes reach the wallet — the account page listing saved cards, and the checkout opening a
 * session against one — and both have to describe the same shopper the same way. When they did it
 * separately they drifted in the only field with a choice in it: a name the gateway shows on the
 * customer record, joined from two nullable halves.
 *
 * Empty becomes `null` rather than `''`. A shopper with neither half filled in has no name to
 * send, and an empty string would overwrite whatever the gateway already holds with nothing.
 */
export function describeAccountHolder(customer: CustomerDTO): EnsureAccountHoldersDTO {
  return {
    customerId: customer.id,
    email: customer.email,
    name: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || null,
  }
}
