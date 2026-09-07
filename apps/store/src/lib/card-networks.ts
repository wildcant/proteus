/**
 * What the storefront says it takes, and what each network is called.
 *
 * Here rather than beside the artwork because two features read it — the checkout's payment rows
 * and the account wallet — and neither owns it. The artwork itself is a component and lives in
 * `#/components/payment-network`.
 */

/**
 * The card networks the storefront advertises, in the order a row shows them.
 *
 * Longer than the three we hold artwork for on purpose: a shopper's card being on this list is
 * what the row is claiming, and the claim is not limited to the badges that happen to fit — the
 * rest collapse into the overflow chip. Which networks the gateway actually accepts is Stripe
 * Dashboard configuration, so this carries the same launch gate the footer's payment strip does:
 * reconcile it against the real provider configuration before the store takes money.
 */
export const ACCEPTED_CARD_NETWORKS = ['visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb', 'unionpay'] as const

/** `amex` → `American Express`, `cartes_bancaires` → `Cartes bancaires`. */
export function networkName(brand: string): string {
  if (brand === 'amex') return 'American Express'
  const words = brand.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A card, reduced to what its name depends on. */
export type NamedMethod = { brand: string; last4: string }

/** `Visa ending in 4242` — the phrase every label and button on a payment row is built from. */
export function savedMethodName(method: NamedMethod): string {
  return `${networkName(method.brand)} ending in ${method.last4}`
}
