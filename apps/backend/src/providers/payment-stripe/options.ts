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
 * Options whose value has a shape the gateway itself guarantees, checked because getting one
 * wrong is worse than leaving it out.
 *
 * `publishableKey` is the one that matters. It is served to every browser by
 * `GET /store/payment-providers`, which is public and unauthenticated, and it is about to be
 * hand-added to a `.env` on the line below `STRIPE_SECRET_KEY`. Nothing else in the system would
 * notice a secret key pasted there — it is a non-empty string, the provider boots, the storefront
 * mounts, and the key is on the wire. Stripe prefixes publishable keys `pk_` and secret ones
 * `sk_`/`rk_`, so the swap is one character class away from being caught, at boot, by name.
 */
const OPTION_PREFIXES: Partial<Record<(typeof REQUIRED_OPTIONS)[number], string>> = {
  publishableKey: 'pk_',
}

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
    if (typeof value !== 'string' || value.trim() === '') {
      throw new AppError({
        type: ErrorTypes.INVALID_ARGUMENT,
        message:
          `Payment provider "${providerId}" cannot start: option "${name}" is ` +
          `${value === undefined ? 'missing' : 'not a non-empty string'}.`,
      })
    }

    const prefix = OPTION_PREFIXES[name]
    if (prefix && !value.trim().startsWith(prefix)) {
      // The value is deliberately not echoed: this is the one branch most likely to be looking at
      // a secret, and a deploy log is not where it should be printed.
      throw new AppError({
        type: ErrorTypes.INVALID_ARGUMENT,
        message:
          `Payment provider "${providerId}" cannot start: option "${name}" does not look like a ` +
          `Stripe ${name} — it must begin with "${prefix}".`,
      })
    }
  }
}
