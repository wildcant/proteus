import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { z } from 'zod'
import { cartQueryOptions } from '#/features/cart/api/cart'
import { CheckoutContent } from '#/features/checkout/components/checkout-content'
import { CheckoutSkeleton } from '#/features/checkout/components/checkout-skeleton'
import { STEPS, Step } from '#/features/checkout/constants'

const checkoutSearchSchema = z.object({
  // Optional, so the cart can link to `/checkout` without choosing a step — which of them a
  // shopper starts on is checkout's rule, not the cart's. `CheckoutContent` resolves it.
  step: z.enum(STEPS).default(Step.CONTACT).catch(Step.CONTACT),
})

export const Route = createFileRoute('/_checkout/checkout')({
  component: CheckoutPage,
  validateSearch: checkoutSearchSchema,
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(cartQueryOptions())
  },
})

function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutContent />
    </Suspense>
  )
}
