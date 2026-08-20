import { getRouteApi, Navigate } from '@tanstack/react-router'
import { useSuspenseCart } from '#/features/cart/api/cart'
import { CheckoutForm } from '#/features/checkout/components/checkout-form'
import { CheckoutSummary } from '#/features/checkout/components/checkout-summary'

const route = getRouteApi('/_checkout/checkout')

export function CheckoutContent() {
  const { step } = route.useSearch()
  const { cart } = useSuspenseCart()

  if (!cart || cart.items.length === 0) {
    return <Navigate to="/cart" />
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
