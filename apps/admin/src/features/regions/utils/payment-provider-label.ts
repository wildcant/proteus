/**
 * `pp_stripe_default` → `Stripe`.
 *
 * A provider id is `pp_{identifier}_{configId}` — the identifier is the gateway, the suffix is
 * which configured instance of it. A merchant choosing where a region takes payment is choosing
 * the gateway, so that is what the label says.
 *
 * Anything that does not parse is title-cased whole rather than dropped: an id from a provider
 * this admin has never heard of is still one the merchant may have to recognise.
 */
export function paymentProviderLabel(providerId: string): string {
  const match = /^pp_(.+)_[^_]+$/.exec(providerId)
  const identifier = match?.[1] ?? providerId

  return identifier
    .split(/[_-]/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
