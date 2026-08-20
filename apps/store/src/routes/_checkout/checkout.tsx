import { createFileRoute, Navigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useCart } from '#/features/cart/api/cart'
import { CheckoutForm } from '#/features/checkout/components/checkout-form'
import { CheckoutSummary } from '#/features/checkout/components/checkout-summary'
import { STEPS, Step } from '#/features/checkout/constants'

const checkoutSearchSchema = z.object({
  step: z.enum(STEPS).catch(Step.ADDRESS),
})

export const Route = createFileRoute('/_checkout/checkout')({
  component: CheckoutPage,
  validateSearch: checkoutSearchSchema,
})

function CheckoutPage() {
  const { step } = Route.useSearch()
  const { cart, isLoading } = useCart()

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-350 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <p className="text-(--foreground-muted)">Loading checkout...</p>
      </main>
    )
  }

  if (!cart || cart.items.length === 0) {
    return <Navigate to="/cart" />
  }

  return (
    <main className="mx-auto w-full max-w-350 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <CheckoutForm cart={cart} step={step} />
        <CheckoutSummary cart={cart} />
      </div>
    </main>
  )
}
