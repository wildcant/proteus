import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { ordersListQueryOptions, ordersPageQuery } from '#/entities/order/api/orders'
import { AccountDetail } from '#/features/account/components/account-detail/account-detail'
import { AccountSkeleton } from '#/features/account/components/account-skeleton/account-skeleton'
import type { AccountLinks } from '#/features/account/types/links'
import { flowLinks } from '#/navigation/links'

const links = flowLinks('AccountDetail')
const accountLinks: AccountLinks = {
  addressBook: links.ADDRESS_BOOK(),
  paymentMethods: links.PAYMENT_METHODS(),
  order: (orderId) => links.ORDER({ params: { orderId } }),
  shopAll: links.SHOP_ALL(),
  signedOut: links.SIGN_OUT(),
}

export const Route = createFileRoute('/_main/_authed/account/')({
  // Fire-and-forget alongside the customer prefetch in `_authed`, so the orders panel resolves
  // in parallel with the greeting rather than after it.
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(ordersListQueryOptions(ordersPageQuery()))
  },
  component: () => (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountDetail links={accountLinks} />
    </Suspense>
  ),
})
