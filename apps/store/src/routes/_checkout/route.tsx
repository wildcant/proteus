import { Trans } from '@lingui/react/macro'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Wordmark } from '#/components/store/wordmark/wordmark'
import { Icon } from '#/components/ui/icon/icon'
import { flowLinks } from '#/navigation/links'

const links = flowLinks('CheckoutLayout')

export const Route = createFileRoute('/_checkout')({
  component: CheckoutLayout,
})

function CheckoutLayout() {
  return (
    <>
      <header className="border-line border-b bg-surface">
        <div className="mx-auto grid w-full max-w-350 grid-cols-3 items-center px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          {/* The map lands BACK_TO_BAG on the home page; the bag over it is this link's own search. */}
          <Link
            {...links.BACK_TO_BAG({ search: { modal: 'cart' } })}
            className="inline-flex items-center gap-1.5 font-medium text-ink-muted text-sm no-underline hover:text-ink"
          >
            <Icon name="arrow-left" className="h-4 w-4" />
            <Trans>Back to cart</Trans>
          </Link>
          <Wordmark link={links.HOME()} className="justify-self-center" />
          <div />
        </div>
      </header>
      <Outlet />
    </>
  )
}
