import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { ForbiddenPage } from '#/components/error/forbidden-page'
import { meQueryOptions } from '#/features/auth/api/auth'
import { getToken } from '#/lib/auth-token'
import { ForbiddenError } from '#/lib/errors'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context }) => {
    const token = getToken()
    if (!token) {
      throw redirect({ to: '/login' })
    }

    const me = await context.queryClient.ensureQueryData(meQueryOptions())
    return {
      user: me.user,
      sidebar: me.sidebar,
      settingsSidebar: me.settingsSidebar,
      allowedActions: me.allowedActions,
    }
  },
  errorComponent: ({ error }) => {
    if (error instanceof ForbiddenError) {
      return <ForbiddenPage />
    }
    throw error
  },
  component: () => <Outlet />,
})
