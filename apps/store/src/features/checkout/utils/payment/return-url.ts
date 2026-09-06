/** The route a gateway that leaves the tab sends the shopper back to. */
export const CHECKOUT_RETURN_PATH = '/checkout-return'

/**
 * Where a redirect payment method returns to.
 *
 * The provider id travels in the query string because the return is a cold page load: nothing of
 * the checkout's state survives it, and the route has to know which adapter is being asked to
 * read the gateway's own parameters back. Everything else on the URL is the gateway's — Stripe
 * appends `payment_intent`, `payment_intent_client_secret` and `redirect_status`.
 */
export function checkoutReturnUrl(providerId: string): string {
  const url = new URL(CHECKOUT_RETURN_PATH, window.location.origin)
  url.searchParams.set('providerId', providerId)
  return url.toString()
}
