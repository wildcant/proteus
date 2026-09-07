/**
 * Currencies whose smallest unit *is* the major unit — a ¥1000 order is `1000`, not `100000`.
 * Stripe's published list, which the backend adapter encodes too.
 */
const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'ugx',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
])

/**
 * A major-unit decimal string as the integer Stripe.js wants.
 *
 * This is the client half of the same unit boundary the backend adapter owns, and it lives here
 * for the same reason: the smallest unit is Stripe's vocabulary, so it exists inside the Stripe
 * adapter and nowhere else. It is deliberately not shared with the backend helper — the backend
 * charges with its result and works in arbitrary precision; this only tells Elements what to
 * display and which methods to offer.
 *
 * Three-decimal currencies are not handled here because nothing above the adapter can express a
 * total in one: multi-currency selling is out of scope and no three-decimal currency is sold. The
 * backend helper, which decides what is actually charged, does handle them.
 */
export function toSmallestUnit(amount: string, currencyCode: string): number {
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currencyCode.toLowerCase()) ? 0 : 2
  const parsed = Number(amount)
  if (!Number.isFinite(parsed)) throw new Error(`Cannot convert "${amount}" to ${currencyCode}'s smallest unit`)
  return Math.round(parsed * 10 ** decimals)
}
