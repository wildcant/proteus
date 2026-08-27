import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { AccountDetail } from '#/features/account/components/account-detail'
import { AccountSkeleton } from '#/features/account/components/account-skeleton'
import { ordersListQueryOptions, ordersPageQuery } from '#/features/orders/api/orders'

export const Route = createFileRoute('/_main/_authed/account/')({
  // Fire-and-forget alongside the customer prefetch in `_authed`, so the orders panel resolves
  // in parallel with the greeting rather than after it.
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(ordersListQueryOptions(ordersPageQuery()))
  },
  component: () => (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountDetail />
    </Suspense>
  ),
})
