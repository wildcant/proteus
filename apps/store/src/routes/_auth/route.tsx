import { Trans } from '@lingui/react/macro'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { flowLinks } from '#/navigation/links'

const links = flowLinks('AuthLayout')

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
})

/**
 * Auth pages stand on their own — no nav, no footer. The wordmark is the only chrome,
 * so nothing competes with the form for attention.
 */
function AuthLayout() {
  return (
    <div className="relative flex min-h-screen flex-col items-center px-4 py-16 sm:py-24">
      {/* Leaving has to stay one click away: with the nav gone, the wordmark is the only
          other way back and shoppers do not reliably read it as a link. */}
      <Link
        {...links.CONTINUE_SHOPPING()}
        className="absolute top-6 left-4 inline-flex items-center gap-1.5 text-sm sm:left-6"
      >
        <ArrowLeftIcon className="size-4" />
        <Trans>Continue shopping</Trans>
      </Link>
      {/* my-auto rather than justify-center: auto margins collapse when the content is
          taller than the viewport, so the register view never clips off the top. */}
      <div className="my-auto flex w-full flex-col items-center">
        <Link {...links.HOME()} className="type-display text-ink">
          Proteus
        </Link>
        <Outlet />
      </div>
    </div>
  )
}
