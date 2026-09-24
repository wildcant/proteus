import type { StripeElementLocale } from '@stripe/stripe-js'

/**
 * The Elements `locale` for a market's locale code.
 *
 * Stripe knows neither `en-US` nor `es-CO`, and a code it does not know is rejected, so each
 * catalog language maps to the nearest one it does. Spanish outside Spain is `es-419`, the same
 * neutral Latin-American Spanish the store's own copy is written in. Anything else falls back to
 * `auto`, which is the browser's language — what Elements did before it was told anything.
 */
export function stripeLocaleFor(localeCode: string): StripeElementLocale {
  const [language, region] = localeCode.split('-')
  if (language === 'es') return region?.toUpperCase() === 'ES' ? 'es-ES' : 'es-419'
  if (language === 'en') return 'en'
  return 'auto'
}
