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
