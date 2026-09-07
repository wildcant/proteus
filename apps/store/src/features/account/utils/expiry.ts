/**
 * Whether a stored card can still be charged.
 *
 * Expiry is ours to compute, not the gateway's: Stripe lists expired cards because expiry is the
 * issuer's business rather than the gateway's, so a wallet that trusts the list to be usable puts
 * a dead card in front of a shopper and lets them press Place order on it.
 *
 * A pure function with its own unit tests rather than a branch inside a row, because the whole of
 * it is the month boundary and the edge cases are cheaper to state than to click through.
 */
export type ExpiryStatus = 'ok' | 'expiring' | 'expired'

/** A card, reduced to what expiry depends on. */
export type ExpiringMethod = { expMonth: number; expYear: number }

/**
 * `expiring` is the last month the card works, so it is labelled and still selectable — a card
 * that expires on the 31st is perfectly good on the 3rd, and refusing it would turn a warning
 * into a wrongly declined checkout.
 *
 * Compared as absolute months rather than by year-then-month, which is the comparison that gets
 * a December card wrong when the year has already rolled over.
 */
export function expiryStatus(method: ExpiringMethod, now: Date = new Date()): ExpiryStatus {
  const thisMonth = now.getFullYear() * 12 + now.getMonth()
  const cardMonth = method.expYear * 12 + (method.expMonth - 1)

  if (cardMonth < thisMonth) return 'expired'
  if (cardMonth === thisMonth) return 'expiring'
  return 'ok'
}

/** A card the shopper can still pay with. The one predicate selection and auto-selection share. */
export function isUsable(method: ExpiringMethod, now: Date = new Date()): boolean {
  return expiryStatus(method, now) !== 'expired'
}

/** `3` and `2027` as `03/27`, which is how the card itself prints it. */
export function formatExpiry(method: ExpiringMethod): string {
  return `${String(method.expMonth).padStart(2, '0')}/${String(method.expYear).slice(-2)}`
}
