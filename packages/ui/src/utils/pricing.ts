/** Returns the narrow currency symbol for a given currency code (e.g. "$" for "USD"). */
export function getCurrencySymbol(currencyCode: string): string {
  const parts = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0)

  const symbolPart = parts.find((part) => part.type === 'currency')
  return symbolPart?.value ?? currencyCode
}

/** Formats a numeric string as a fully styled currency value with symbol (e.g. "$10.00"). */
export function formatPrice(amount: string, currencyCode: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(Number(amount))
}

/** Formats a numeric string with currency-appropriate decimal places but no symbol (e.g. "10.00"). */
export function formatAmount(value: string, currencyCode: string): string {
  const number = Number(value)
  if (Number.isNaN(number)) return value

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).resolvedOptions().minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(number)
}
