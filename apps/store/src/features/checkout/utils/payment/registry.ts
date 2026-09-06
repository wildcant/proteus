import type { StorePaymentAdapter } from '../../types/payment'
import { stripeAdapter } from './adapters/stripe/adapter'

/**
 * Every client payment adapter the storefront has, keyed by provider identifier.
 *
 * Adding a gateway is one adapter and one entry here — nothing in the checkout form, the
 * place-order sequence or cart completion changes. That is the property the port exists for, and
 * the dependency-cruiser rule `stripe-stays-in-its-adapter` is what stops it rotting.
 */
const ADAPTERS: StorePaymentAdapter[] = [stripeAdapter]

/**
 * The adapter for a provider row, or `undefined` when the storefront has none.
 *
 * Provider ids are `pp_{identifier}_{configId}` — `pp_stripe_default` — so the match is on the
 * prefix rather than the whole id: one adapter serves every configured instance of its gateway.
 *
 * `undefined` is a real answer, not a failure. The system provider ("Manual Payment") takes no
 * card details and needs no adapter; the checkout opens its session and completes the cart with
 * no confirmation step.
 */
export function resolvePaymentAdapter(providerId: string): StorePaymentAdapter | undefined {
  return ADAPTERS.find((adapter) => providerId.startsWith(`pp_${adapter.id}_`))
}
