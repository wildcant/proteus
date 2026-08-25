import { createFileRoute, Outlet } from '@tanstack/react-router'
import { CartMismatchBanner } from '../../components/cart-mismatch-banner'
import { Footer } from '../../components/footer'
import { Header } from '../../components/header/header'

export const Route = createFileRoute('/_main')({
  ssr: true,
  component: MainLayout,
})

function MainLayout() {
  return (
    <>
      <Header />
      <CartMismatchBanner />
      <Outlet />
      <Footer />
    </>
  )
}
