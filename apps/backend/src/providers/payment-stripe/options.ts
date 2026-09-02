import { AppError, ErrorTypes } from '../../core/errors/app-error.js'

export type StripeOptions = {
  apiKey: string
  webhookSecret: string
  /**
   * The browser's half of the key pair. Not a secret — it is served to every storefront by
   * `GET /store/payment-providers` — but required all the same: without it the card form has
   * nothing to boot Stripe.js with.
   */
  publishableKey: string
  /** Attempts for a write the gateway failed transiently. Includes the first. */
  retryAttempts?: number
  /** Wait before the second attempt; doubled, with jitter, for each one after it. */
  retryBackoffMs?: number
}

/** Nothing here has a safe default: a blank key is a live deployment that cannot take money. */
const REQUIRED_OPTIONS = ['apiKey', 'webhookSecret', 'publishableKey'] as const

/**
 * Run by the provider loader before the adapter is constructed.
 *
 * `new Stripe('')` succeeds, so a deployment configured with a missing or blank key boots
 * cleanly and fails at the first payment — in front of a shopper, as an unexplained decline,
 * hours after the deploy that caused it. This turns that into a startup failure that names the
 * provider and the option.
 */
export function validateStripeOptions(providerId: string, options: Record<string, unknown>): void {
  for (const name of REQUIRED_OPTIONS) {
    const value = options[name]
    if (typeof value === 'string' && value.trim() !== '') continue

    throw new AppError({
      type: ErrorTypes.INVALID_ARGUMENT,
      message:
        `Payment provider "${providerId}" cannot start: option "${name}" is ` +
        `${value === undefined ? 'missing' : 'not a non-empty string'}.`,
    })
  }
}
