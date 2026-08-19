import { Button, formatPrice } from '@proteus/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCart } from '#/features/cart/api/cart'
import { CartItem } from '#/features/cart/components/cart-item'
import { EmptyCart } from '#/features/cart/components/empty-cart'

export const Route = createFileRoute('/_main/cart')({
  component: CartPage,
})

function CartPage() {
  const { cart, isLoading } = useCart()

  if (isLoading) {
    return (
      <main className="page-wrap px-4 pb-8 pt-14">
        <p className="text-(--sea-ink-soft)">Loading cart...</p>
      </main>
    )
  }

  if (!cart || cart.items.length === 0) {
    return <EmptyCart />
  }

  const sortedItems = [...cart.items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <h1 className="display-title mb-8 text-4xl font-bold tracking-tight text-(--sea-ink)">Cart</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          {sortedItems.map((item) => (
            <CartItem key={item.id} item={item} currencyCode={cart.currencyCode} />
          ))}
        </section>

        <aside className="island-shell h-fit rounded-2xl p-6">
          <h2 className="mb-4 text-lg font-semibold text-(--sea-ink)">Order summary</h2>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-(--sea-ink-soft)">Items total</dt>
              <dd className="font-medium text-(--sea-ink)">{formatPrice(cart.totals.itemsTotal, cart.currencyCode)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-(--sea-ink-soft)">Shipping</dt>
              <dd className="font-medium text-(--sea-ink)">
                {Number(cart.totals.shippingTotal) === 0
                  ? 'Calculated at checkout'
                  : formatPrice(cart.totals.shippingTotal, cart.currencyCode)}
              </dd>
            </div>
            <div className="border-t border-(--line) pt-3">
              <div className="flex justify-between text-base">
                <dt className="font-semibold text-(--sea-ink)">Total</dt>
                <dd className="font-semibold text-(--sea-ink)">
                  {formatPrice(cart.totals.cartTotal, cart.currencyCode)}
                </dd>
              </div>
            </div>
          </dl>

          <Button render={<Link to="/checkout" />} variant="outline" className="mt-6 w-full">
            Go to checkout
          </Button>
        </aside>
      </div>
    </main>
  )
}
