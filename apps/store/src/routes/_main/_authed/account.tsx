import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { AccountDetail } from '#/features/account/components/account-detail'
import { AccountSkeleton } from '#/features/account/components/account-skeleton'

export const Route = createFileRoute('/_main/_authed/account')({
  component: () => (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountDetail />
    </Suspense>
  ),
})
