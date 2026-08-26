import { getRouteApi, Navigate } from '@tanstack/react-router'
import { useSuspenseCart } from '#/features/cart/api/cart'
import { CheckoutForm } from '#/features/checkout/components/checkout-form'
import { CheckoutSummary } from '#/features/checkout/components/checkout-summary'
import { Step } from '#/features/checkout/constants'
import { isGuest } from '#/lib/auth-token'

const route = getRouteApi('/_checkout/checkout')

export function CheckoutContent() {
  const { step } = route.useSearch()
  const { cart } = useSuspenseCart()

  // Nothing to check out, and no cart page to land on. The catalogue is the honest destination:
  // opening the panel over it would only say "empty" a second time.
  if (!cart || cart.items.length === 0) {
    return <Navigate to="/products" />
  }

  // A signed-in shopper has already given us their email, so the contact step does not apply.
  // This redirects rather than just rendering the next step: the URL is what says which step the
  // shopper is on — `goToStep` writes to it, and refresh, back and deep links read from it.
  if (!isGuest() && step === Step.CONTACT) {
    return <Navigate to="/checkout" search={{ step: Step.ADDRESS }} replace />
  }

  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <CheckoutForm cart={cart} step={step} />
        <CheckoutSummary cart={cart} />
      </div>
    </main>
  )
}
