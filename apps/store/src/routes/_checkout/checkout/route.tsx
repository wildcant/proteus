import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Suspense } from 'react'
import { cartQueryOptions } from '#/entities/cart/api/cart'
import { CheckoutContent } from '#/features/checkout/components/checkout-content/checkout-content'
import { CheckoutSkeleton } from '#/features/checkout/components/checkout-skeleton'
import type { CheckoutLinks } from '#/features/checkout/types/links'
import { flowLinks } from '#/navigation/links'

const links = flowLinks('CheckoutContent')
const checkoutLinks: CheckoutLinks = {
  bagEmpty: links.BAG_EMPTY(),
  signIn: links.SIGN_IN({ search: { redirect: '/checkout' } }),
  signedOut: links.SIGN_OUT(),
  orderPlaced: (orderId) => links.PLACE_ORDER('OrderConfirmedContent', { params: { orderId } }),
  addAddress: links.ADD_ADDRESS(),
  editAddress: (addressId) => links.EDIT_ADDRESS({ params: { addressId } }),
}

// No `validateSearch`: checkout is one page, so there is no step to put in the URL. Leaving the
// validator off is also what makes a bookmarked `?step=review` harmless — an unvalidated param
// the route ignores rather than one it throws on.
export const Route = createFileRoute('/_checkout/checkout')({
  component: CheckoutPage,
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(cartQueryOptions())
  },
})

/**
 * The page is the layout, so the address drawers open over a checkout that stays mounted — the
 * shopper's scroll position, the payment they picked and the fields they typed all survive a trip
 * to the address book and back.
 */
function CheckoutPage() {
  return (
    <>
      <Suspense fallback={<CheckoutSkeleton />}>
        <CheckoutContent links={checkoutLinks} />
      </Suspense>
      <Outlet />
    </>
  )
}
