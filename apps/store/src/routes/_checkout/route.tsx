import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'

export const Route = createFileRoute('/_checkout')({
  component: CheckoutLayout,
})

function CheckoutLayout() {
  return (
    <>
      <header className="border-border border-b bg-white dark:bg-neutral-950">
        <div className="mx-auto grid w-full max-w-350 grid-cols-3 items-center px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <Link
            to="/cart"
            className="inline-flex items-center gap-1.5 font-medium text-(--foreground-muted) text-sm no-underline hover:text-foreground"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to cart
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center font-semibold text-foreground text-sm uppercase tracking-[0.2em] no-underline"
          >
            Proteus
          </Link>
          <div />
        </div>
      </header>
      <Outlet />
    </>
  )
}
