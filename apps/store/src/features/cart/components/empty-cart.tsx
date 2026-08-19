import { Link } from '@tanstack/react-router'
import { ShoppingBagIcon } from 'lucide-react'
import { Button } from '#/components/button'

export function EmptyCart() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <section className="flex flex-col items-center py-20 text-center">
        <ShoppingBagIcon className="mb-4 h-12 w-12 text-(--foreground-muted)" />
        <h1 className="mb-2 text-2xl font-medium text-(--foreground)">Your cart is empty</h1>
        <p className="mb-6 text-sm text-(--foreground-muted)">Browse our products and find something you like.</p>
        <Link to="/products">
          <Button>Browse products</Button>
        </Link>
      </section>
    </main>
  )
}
