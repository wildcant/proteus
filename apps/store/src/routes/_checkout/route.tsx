import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { ArrowLeftIcon } from 'lucide-react'

export const Route = createFileRoute('/_checkout')({
  component: CheckoutLayout,
})

function CheckoutLayout() {
  return (
    <>
      <header className="border-b border-(--line) bg-(--header-bg) backdrop-blur-lg">
        <div className="page-wrap grid grid-cols-3 items-center px-4 py-3 sm:py-4">
          <Link
            to="/cart"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-(--sea-ink-soft) no-underline hover:text-(--sea-ink)"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to cart
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-(--sea-ink) no-underline"
          >
            <span className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
            Proteus
          </Link>
          <div />
        </div>
      </header>
      <Outlet />
    </>
  )
}
