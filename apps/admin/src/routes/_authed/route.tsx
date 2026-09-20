import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { meQueryOptions } from '#/features/auth/api/auth'
import { getToken } from '#/lib/auth-token'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context }) => {
    const token = getToken()
    if (!token) {
      throw redirect({ to: '/login' })
    }

    const { user } = await context.queryClient.ensureQueryData(meQueryOptions())
    return { user }
  },
  component: () => <Outlet />,
})
