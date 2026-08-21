import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { customerMeQueryOptions } from '#/features/account/api/customer'
import { getToken } from '#/lib/auth-token'

export const Route = createFileRoute('/_main/_authed')({
  beforeLoad: ({ context }) => {
    const token = getToken()
    if (!token) {
      throw redirect({ to: '/login' })
    }

    context.queryClient.prefetchQuery(customerMeQueryOptions())
  },
  component: () => <Outlet />,
})
