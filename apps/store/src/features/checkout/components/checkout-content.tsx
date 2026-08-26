import { Navigate } from '@tanstack/react-router'
import { useSuspenseCart } from '#/features/cart/api/cart'
import { CheckoutForm } from '#/features/checkout/components/checkout-form'
import { CheckoutSummary } from './checkout-summary'

/**
 * The split. The one store surface that is not `max-w-350` — the grey runs to the viewport edge
 * because the summary is the other half of the page, not a card on it. Summary first in the DOM so
 * a phone gets the disclosure above the form; `lg:order-*` puts it on the right at the split.
 */
export function CheckoutContent() {
  const { cart } = useSuspenseCart()

  // Nothing to check out, and no cart page to land on. The catalogue is the honest destination:
  // opening the panel over it would only say "empty" a second time.
  if (!cart || cart.items.length === 0) {
    return <Navigate to="/products" />
  }

  return (
    <main className="lg:grid lg:grid-cols-2">
      <CheckoutSummary cart={cart} />

      <div className="bg-surface px-4 pt-8 pb-16 lg:order-1 lg:px-10 lg:pt-10">
        <div className="mx-auto w-full max-w-125 lg:mr-0 lg:ml-auto">
          <CheckoutForm cart={cart} />
        </div>
      </div>
    </main>
  )
}
