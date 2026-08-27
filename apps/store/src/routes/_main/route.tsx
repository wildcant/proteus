import { createFileRoute, Outlet } from '@tanstack/react-router'
import { CartMismatchBanner } from '../../components/cart-mismatch-banner'
import { Footer } from '../../components/footer'
import { Header } from '../../components/header/header'

export const Route = createFileRoute('/_main')({
  ssr: true,
  component: MainLayout,
})

/**
 * The wrapper around `Outlet` is what keeps the footer at the bottom of a short page. Without
 * it, a page with little content — an order of two items, an empty result set — left the footer
 * floating mid-viewport with dead surface below it. Applied here rather than on each `main` so
 * a route does not have to opt in to being laid out correctly.
 */
function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <CartMismatchBanner />
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
      <Footer />
    </div>
  )
}
