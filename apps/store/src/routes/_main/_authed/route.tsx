import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { customerMeQueryOptions } from '#/features/account/api/customer'
import { isRegistered } from '#/lib/auth-token'

export const Route = createFileRoute('/_main/_authed')({
  beforeLoad: ({ context }) => {
    // isRegistered, not getToken: an unverified signup token cannot satisfy any
    // customer-scoped endpoint, so letting it through only renders a broken page.
    if (!isRegistered()) {
      throw redirect({ to: '/login' })
    }

    context.queryClient.prefetchQuery(customerMeQueryOptions())
  },
  component: () => <Outlet />,
})
