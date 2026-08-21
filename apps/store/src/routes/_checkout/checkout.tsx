import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { z } from 'zod'
import { cartQueryOptions } from '#/features/cart/api/cart'
import { CheckoutContent } from '#/features/checkout/components/checkout-content'
import { CheckoutSkeleton } from '#/features/checkout/components/checkout-skeleton'
import { STEPS, Step } from '#/features/checkout/constants'

const checkoutSearchSchema = z.object({
  step: z.enum(STEPS).catch(Step.CONTACT),
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
