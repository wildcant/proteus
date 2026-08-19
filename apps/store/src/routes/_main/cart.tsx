import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/cart')({
  component: CartPage,
})

function CartPage() {
  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <h1 className="display-title text-4xl font-bold tracking-tight text-(--sea-ink)">Cart</h1>
      <p className="mt-4 text-(--sea-ink-soft)">Coming soon</p>
    </main>
  )
}
