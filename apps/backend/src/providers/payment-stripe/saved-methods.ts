import type Stripe from 'stripe'
import type { SavedMethodDTO } from '../../core/types/payment/common.js'

/**
 * The gateway's payment methods, in the wallet's vocabulary.
 *
 * This is the last place a `Stripe.PaymentMethod` exists. Everything above it is handed the
 * neutral shape, which is what makes "never the raw gateway object" a property of the code
 * rather than a rule someone has to remember at each route.
 */

/** Stripe counts seconds; the rest of the system counts milliseconds. */
function storedAt(method: Stripe.PaymentMethod): Date {
  return new Date(method.created * 1000)
}

/**
 * The method the gateway itself treats as the default.
 *
 * Stripe hands this back as an id or, when the caller expanded it, as the whole object — and a
 * deleted customer has no `invoice_settings` at all. Reading `.id` off a string silently yields
 * `undefined`, which would quietly mark nothing as the default.
 */
export function defaultMethodIdOf(customer: Stripe.Customer | Stripe.DeletedCustomer): string | null {
  if (customer.deleted) return null
  const method = customer.invoice_settings?.default_payment_method
  if (!method) return null
  return typeof method === 'string' ? method : method.id
}

/**
 * Cards only, deliberately.
 *
 * A saved bank debit or wallet has no brand and no last four, and projecting one with empty
 * strings puts a blank, unidentifiable row in front of a shopper choosing what to pay with.
 * Until the neutral shape can describe more than a card, a method that is not one is not listed.
 */
export function toSavedMethods(methods: Stripe.PaymentMethod[], defaultMethodId: string | null): SavedMethodDTO[] {
  return methods.flatMap((method) => {
    const card = method.card
    if (!card) return []

    return [
      {
        id: method.id,
        brand: card.brand,
        last4: card.last4,
        expMonth: card.exp_month,
        expYear: card.exp_year,
        isDefault: method.id === defaultMethodId,
        createdAt: storedAt(method),
      },
    ]
  })
}
