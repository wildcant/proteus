import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { customerMeQueryOptions } from '#/features/account/api/customer'
import { getToken } from '#/lib/auth-token'

export const Route = createFileRoute('/_main/_authed')({
  beforeLoad: async ({ context }) => {
    const token = getToken()
    if (!token) {
      throw redirect({ to: '/login' })
    }

    const { customer } = await context.queryClient.ensureQueryData(customerMeQueryOptions())
    return { customer }
  },
  component: () => <Outlet />,
})
