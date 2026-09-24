import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { ForbiddenPage } from '#/components/error/forbidden-page'
import { meQueryOptions } from '#/features/auth/api/auth'
import { getToken } from '#/lib/auth-token'
import { ForbiddenError } from '#/lib/errors'
import { rememberLocale } from '#/lib/i18n/locale'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context }) => {
    const token = getToken()
    if (!token) {
      throw redirect({ to: '/login' })
    }

    const me = await context.queryClient.ensureQueryData(meQueryOptions())
    // Signed in on a browser that last rendered another language: this page load's catalog is the
    // wrong one, and only a reload swaps it.
    if (rememberLocale(me.user.locale)) window.location.reload()
    return me
  },
  errorComponent: ({ error }) => {
    if (error instanceof ForbiddenError) {
      return <ForbiddenPage />
    }
    throw error
  },
  component: () => <Outlet />,
})
