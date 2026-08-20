import { createFileRoute, Outlet } from '@tanstack/react-router'
import { CartMismatchBanner } from '../../components/cart-mismatch-banner'
import { Footer } from '../../components/footer'
import { Nav } from '../../components/nav'

export const Route = createFileRoute('/_main')({
  component: MainLayout,
})

function MainLayout() {
  return (
    <>
      <Nav />
      <CartMismatchBanner />
      <Outlet />
      <Footer />
    </>
  )
}
