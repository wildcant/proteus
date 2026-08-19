import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_checkout/checkout')({
  component: CheckoutPage,
})

function CheckoutPage() {
  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <h1 className="display-title text-4xl font-bold tracking-tight text-[var(--sea-ink)]">Checkout</h1>
      <p className="mt-4 text-[var(--sea-ink-soft)]">Coming soon</p>
    </main>
  )
}
