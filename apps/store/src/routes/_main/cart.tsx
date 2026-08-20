import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { cartQueryOptions } from '#/features/cart/api/cart'
import { CartContent } from '#/features/cart/components/cart-content'
import { CartSkeleton } from '#/features/cart/components/cart-skeleton'

export const Route = createFileRoute('/_main/cart')({
  component: CartPage,
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(cartQueryOptions())
  },
})

function CartPage() {
  return (
    <Suspense fallback={<CartSkeleton />}>
      <CartContent />
    </Suspense>
  )
}
