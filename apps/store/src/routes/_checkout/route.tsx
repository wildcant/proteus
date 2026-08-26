import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { Wordmark } from '#/components/header/wordmark'

export const Route = createFileRoute('/_checkout')({
  component: CheckoutLayout,
})

function CheckoutLayout() {
  return (
    <>
      <header className="border-line border-b bg-surface">
        <div className="mx-auto grid w-full max-w-350 grid-cols-3 items-center px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <Link
            to="/products"
            search={{ modal: 'cart' }}
            className="inline-flex items-center gap-1.5 font-medium text-ink-muted text-sm no-underline hover:text-ink"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to cart
          </Link>
          <Wordmark className="justify-self-center" />
          <div />
        </div>
      </header>
      <Outlet />
    </>
  )
}
