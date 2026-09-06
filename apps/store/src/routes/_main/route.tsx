import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Footer } from '#/components/footer'
import { Header } from '#/components/header/header'
import { useMe } from '#/features/account/api/customer'
import { CartDrawer } from '#/features/cart/components/cart-drawer'
import { CartMismatchBanner } from '#/features/cart/components/cart-mismatch-banner'
import { CartTrigger } from '#/features/cart/components/cart-trigger'
import { SearchDrawer } from '#/features/products/components/search-drawer'

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
  // The app layer is the only place allowed to compose two features, which is why the bag, the
  // drawers and the mismatch banner are wired together here rather than inside the header.
  const { customer } = useMe()

  return (
    <div className="flex min-h-screen flex-col">
      <Header actions={<CartTrigger />} />
      <SearchDrawer />
      <CartDrawer />
      <CartMismatchBanner customerId={customer?.id} />
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
      <Footer />
    </div>
  )
}
