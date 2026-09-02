import { useEffect } from 'react'
import { usePaymentControllerContext } from './payment-controller'
import type { PaymentAdapterContext, StorePaymentAdapter } from './types'

/**
 * The provider-neutral payment method selector.
 *
 * Three renders are specified — loading, empty, populated — and this ticket builds the **empty**
 * one: the adapter's own form as the whole step, with no radio group. A one-option radio group
 * invents a choice that does not exist, and until saved cards land (ILLO-24) there is exactly one
 * option for every shopper, logged in or not.
 *
 * The rows, the "use a different card" row and the auto-selection guard belong to ILLO-24 and are
 * deliberately absent rather than stubbed.
 */
type PaymentMethodSelectorProps = {
  adapter: StorePaymentAdapter
  context: PaymentAdapterContext
}

export function PaymentMethodSelector({ adapter, context }: PaymentMethodSelectorProps) {
  return (
    <adapter.Root context={context}>
      <RegisterConfirm adapter={adapter} />
      {/* Gated on the session, never on a wallet count — a logged-in shopper with nothing saved
          still needs to be able to save their first card. The control itself is ILLO-24's. */}
      <adapter.NewMethodForm canSaveMethod={context.customer?.hasAccount === true} />
    </adapter.Root>
  )
}

/**
 * Hands the mounted adapter's confirm up to the place-order button.
 *
 * A component rather than a call in the selector because `useConfirm` must run inside the
 * adapter's `Root`, and `Root` is this component's parent rather than its caller's.
 */
function RegisterConfirm({ adapter }: Pick<PaymentMethodSelectorProps, 'adapter'>) {
  const confirm = adapter.useConfirm()
  const { register } = usePaymentControllerContext()

  useEffect(() => {
    register(confirm)
    // Unregistering on unmount is what makes a provider switch safe: the button would otherwise
    // keep confirming through the adapter the shopper just navigated away from.
    return () => register(null)
  }, [confirm, register])

  return null
}
