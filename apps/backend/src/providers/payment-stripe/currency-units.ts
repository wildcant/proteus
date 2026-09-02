import { BigNumber } from '../../core/db/bignum.js'

/**
 * Currencies whose smallest unit is not one hundredth of the major unit.
 *
 * Two decimals is the rule, so only the exceptions are listed. Getting this wrong is not a
 * rounding error: a ¥1000 charge sent as `100000` takes a hundred times the order total.
 */
const ZERO_DECIMAL_CURRENCIES = [
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
]

const THREE_DECIMAL_CURRENCIES = ['bhd', 'iqd', 'jod', 'kwd', 'lyd', 'omr', 'tnd']

const DEFAULT_EXPONENT = 2

const EXPONENT_BY_CURRENCY: ReadonlyMap<string, number> = new Map([
  ...ZERO_DECIMAL_CURRENCIES.map((code) => [code, 0] as const),
  ...THREE_DECIMAL_CURRENCIES.map((code) => [code, 3] as const),
])

function exponentOf(currencyCode: string): number {
  return EXPONENT_BY_CURRENCY.get(currencyCode.toLowerCase()) ?? DEFAULT_EXPONENT
}

/**
 * The major-unit decimal every layer above this adapter works in, as the smallest-unit integer
 * Stripe requires. `19.99` USD is `1999`; `1000` JPY stays `1000`; `19.99` BHD is `19990`.
 *
 * Not a fixed multiplier — the exponent is the currency's, which is the whole point of the
 * helper existing rather than a `* 100` at each call site.
 */
export function toSmallestUnit(amount: BigNumber, currencyCode: string): number {
  const exponent = exponentOf(currencyCode)
  const scaled = amount.shiftedBy(exponent)

  // Stripe only accepts three-decimal amounts as a multiple of ten. Rounding up rather than
  // to nearest, so the charge is never a fraction short of what the shopper agreed to.
  //
  // TODO(multi-currency): this round trip is lossy upward. A 19.995 KWD total is sent as 20000
  // and read back as 20.000, so the shopper is charged 0.005 KWD more than the order total while
  // the Payment row records the lower figure. Unreachable today — no three-decimal currency is
  // sold — and the fix belongs with multi-currency pricing, which owns the choice between
  // rounding the stored total to what the gateway can charge and rejecting a total the currency
  // cannot represent. See *Multi-currency pricing* in `.scratch/checkout-payment/spec.md`.
  if (exponent === 3) {
    return scaled.dividedBy(10).integerValue(BigNumber.ROUND_CEIL).multipliedBy(10).toNumber()
  }

  return scaled.integerValue(BigNumber.ROUND_HALF_UP).toNumber()
}

/** The inverse, for every amount read back off Stripe before it leaves this adapter. */
export function fromSmallestUnit(amount: number, currencyCode: string): BigNumber {
  return new BigNumber(amount).shiftedBy(-exponentOf(currencyCode))
}
