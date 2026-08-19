import { Button } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { ShoppingBagIcon } from 'lucide-react'

export function EmptyCart() {
  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in flex flex-col items-center rounded-[2rem] px-6 py-16 text-center">
        <ShoppingBagIcon className="mb-4 h-12 w-12 text-(--sea-ink-soft)" />
        <h1 className="display-title mb-2 text-2xl font-bold tracking-tight text-(--sea-ink)">Your cart is empty</h1>
        <p className="mb-6 text-(--sea-ink-soft)">Browse our products and find something you like.</p>
        <Link to="/products">
          <Button>Browse products</Button>
        </Link>
      </section>
    </main>
  )
}
