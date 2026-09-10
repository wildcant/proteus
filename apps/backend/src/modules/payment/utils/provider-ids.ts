/**
 * How a payment provider is named, in one place.
 *
 * The same string is three things at once: the key the provider instance is registered under in
 * the module's container, the row in `payment_provider`, and the `providerId` stored on every
 * session and payment. They are only the same string because everything builds them here — the
 * prefix used to be written out at each registration site, which is a drift nobody would notice
 * until a lookup missed and a shopper's checkout could not find its gateway.
 *
 * It lives in `utils/` rather than beside the loader because the service needs it too, and a
 * service reaching into the DI wiring to learn what a provider is called has the dependency
 * backwards.
 */
const REGISTRATION_PREFIX = 'pp_'

/** The registration key, table row and stored `providerId` for a bare provider key. */
export function paymentProviderId(key: string): string {
  return `${REGISTRATION_PREFIX}${key}`
}

/** The provider that ships with the module. Registered unconditionally, so it is always resolvable. */
export const SYSTEM_PROVIDER_KEY = 'system_default'

/**
 * The provider that settles a collection nobody charged — see `markPaymentCollectionAsPaid`.
 *
 * In-process and entirely local: it authorizes whatever it is handed and talks to no gateway,
 * which is what makes it the right answer for money taken outside Proteus, and what makes it safe
 * to call inside a database transaction.
 */
export const MANUAL_PROVIDER_ID = paymentProviderId(SYSTEM_PROVIDER_KEY)
