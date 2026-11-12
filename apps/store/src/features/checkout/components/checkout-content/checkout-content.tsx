import { cn } from '@proteus/ui-core'
import { Navigate } from '@tanstack/react-router'
import { useSuspenseCart } from '#/entities/cart/api/cart'
import {
  checkoutContent,
  checkoutContentForm,
  checkoutContentFormColumn,
  checkoutContentFormInner,
  checkoutContentSummary,
} from '#/features/checkout/components/checkout-content/checkout-content.variants'
import { CheckoutForm } from '#/features/checkout/components/checkout-form/checkout-form'
import { CheckoutSummary } from '#/features/checkout/components/checkout-summary/checkout-summary'

/**
 * The split. The one store surface that is not `max-w-350` — the grey runs to the viewport edge
 * because the summary is the other half of the page, not a card on it.
 *
 * Summary first in the DOM, so a phone reads (and tabs to) the disclosure above the form. The set
 * draws the desktop order and reverses it on mobile (`flex-col-reverse lg:flex-row`), which would
 * put the form first for the keyboard on a phone; the direction is the DOM's here instead.
 */
export function CheckoutContent() {
  const { cart } = useSuspenseCart()

  // Nothing to check out, and no cart page to land on. The catalogue is the honest destination:
  // opening the panel over it would only say "empty" a second time.
  if (!cart || cart.items.length === 0) {
    return <Navigate to="/" />
  }

  return (
    <main className={cn(checkoutContent(), 'flex-col lg:flex-row-reverse')}>
      {/* `lg:basis-1/2` on both halves: the drawn halves share the width net of padding, and a
          CSS `flex-1` column adds its own 80px of padding on top of its half. */}
      <CheckoutSummary cart={cart} className={cn(checkoutContentSummary(), 'lg:basis-1/2')} />

      <div className={cn(checkoutContentFormColumn(), 'lg:basis-1/2')}>
        <div className={cn(checkoutContentFormInner(), 'mx-auto w-full lg:mr-0 lg:ml-auto')}>
          <CheckoutForm cart={cart} className={checkoutContentForm()} />
        </div>
      </div>
    </main>
  )
}
