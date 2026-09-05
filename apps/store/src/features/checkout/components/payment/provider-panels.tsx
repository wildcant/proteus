import type { StorePaymentProvider } from '@proteus/http-schemas/store'
import { InfoIcon } from 'lucide-react'
import { useEffect } from 'react'
import type { CheckoutData } from '../../hooks/use-checkout-data'
import { PaymentMethodSelector } from '../../payment/payment-method-selector'
import { resolvePaymentAdapter } from '../../payment/registry'
import type { PaymentAdapterContext } from '../../payment/types'

/** Shown against a provider that takes no real money, wherever that provider is rendered. */
export function TestOnlyNotice() {
  return (
    <span className="flex w-full items-start gap-2 bg-surface-subtle px-3 py-1.5 text-ink-muted text-xs">
      <InfoIcon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      For testing purposes only. No payment is taken.
    </span>
  )
}

/**
 * Selects the only provider there is, once, and renders its name rather than a radio for it.
 *
 * A one-option radio group invents a choice that does not exist — the same rule the selector
 * applies to a wallet of one. The selection is still ordinary form state either way, so validation
 * and the place-order sequence do not branch on how it was made.
 */
export function SoleProvider({
  provider,
  value,
  onSelect,
}: {
  provider: StorePaymentProvider
  value: string
  onSelect: (providerId: string) => void
}) {
  useEffect(() => {
    if (value !== provider.id) onSelect(provider.id)
  }, [provider.id, value, onSelect])

  return provider.isTestOnly ? <TestOnlyNotice /> : null
}

/**
 * The selected provider's own surface, or nothing.
 *
 * Nothing is a real answer: the system provider takes no card details, so it has no client adapter
 * and the step is the provider row alone. The checkout still opens a session for it at submit and
 * completes the cart with no confirmation step.
 */
export function ActiveProviderPanel({
  provider,
  cart,
  customer,
}: { provider: StorePaymentProvider } & Pick<CheckoutData, 'cart' | 'customer'>) {
  const adapter = resolvePaymentAdapter(provider.id)
  if (!adapter) return null

  const context: PaymentAdapterContext = {
    publicConfig: provider.publicConfig,
    // A display and eligibility input only. What is charged is priced server-side when the
    // session is opened, and the adapter is told that figure before it confirms.
    amount: cart.totals.cartTotal,
    currencyCode: cart.currencyCode,
    customer: customer ? { id: customer.id, hasAccount: customer.hasAccount } : null,
  }

  return (
    // No box of its own. The payment step is *one* bordered list — provider rows, then the saved
    // cards, then "use a different card" — and a wrapper here made the whole wallet a panel
    // nested inside the provider list, which is the shape the spec rules out. The rows draw their
    // own edges and collapse against the row above, so this only has to not get in the way.
    <div data-testid="payment-panel" className="relative -mt-px">
      <PaymentMethodSelector adapter={adapter} context={context} />
    </div>
  )
}
