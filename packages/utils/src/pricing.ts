/**
 * The locale used when a caller does not name one.
 *
 * The admin has one market and formats everything American, so it never passes a locale and must
 * keep rendering exactly what it renders today. The storefront is the caller that does pass one —
 * its market's tag — which is what turns `COP 100,000` into `$ 100.000` for a Colombian shopper.
 */
const DEFAULT_LOCALE = 'en-US'

/** Returns the narrow currency symbol for a given currency code (e.g. "$" for "USD"). */
export function getCurrencySymbol(currencyCode: string, locale: string = DEFAULT_LOCALE): string {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0)

  const symbolPart = parts.find((part) => part.type === 'currency')
  return symbolPart?.value ?? currencyCode
}

/**
 * The currency's name in words — `Euro`, `US Dollar` — for a label a code alone does not explain.
 *
 * Derived rather than stored: `Intl.DisplayNames` already ships every ISO 4217 name in every
 * locale the runtime supports, so a table of them would only be a copy going stale. A code the
 * runtime does not know is returned uppercased, which is still the best label available for it.
 *
 * The `try` is not defensive padding. `Intl.DisplayNames` answers an unrecognised-but-well-formed
 * code such as `ZZZ` with the code itself, but a *malformed* one — anything that is not three
 * letters — with a `RangeError`, and so does a malformed locale. This is a label in a table cell
 * and in a select option, rendered once per row: an exception here does not spoil a label, it
 * takes down the Currencies card and the region editor with it. The uppercased code is the same
 * fallback the unknown-currency case already gets.
 */
export function getCurrencyName(currencyCode: string, locale: string = DEFAULT_LOCALE): string {
  const fallback = currencyCode.toUpperCase()

  try {
    return new Intl.DisplayNames([locale], { type: 'currency' }).of(fallback) ?? fallback
  } catch {
    return fallback
  }
}

/** Formats a numeric string as a fully styled currency value with symbol (e.g. "$10.00"). */
export function formatPrice(amount: string, currencyCode: string, locale: string = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(Number(amount))
}

/** Formats a numeric string with currency-appropriate decimal places but no symbol (e.g. "10.00"). */
export function formatAmount(value: string, currencyCode: string, locale: string = DEFAULT_LOCALE): string {
  const number = Number(value)
  if (Number.isNaN(number)) return value

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).resolvedOptions().minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(number)
}
