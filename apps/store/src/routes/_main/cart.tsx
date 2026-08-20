import { formatPrice } from '@proteus/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '#/components/button'
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
      <main className="mx-auto w-full max-w-350 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <p className="text-(--foreground-muted)">Loading cart...</p>
      </main>
    )
  }

  if (!cart || cart.items.length === 0) {
    return <EmptyCart />
  }

  const sortedItems = [...cart.items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <main className="mx-auto w-full max-w-350 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-2xl font-medium text-foreground">Cart</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          {sortedItems.map((item) => (
            <CartItem key={item.id} item={item} currencyCode={cart.currencyCode} />
          ))}
        </section>

        <aside className="h-fit rounded-lg border border-border p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Order summary</h2>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-(--foreground-muted)">Items total</dt>
              <dd className="font-medium text-foreground">{formatPrice(cart.totals.itemsTotal, cart.currencyCode)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-(--foreground-muted)">Shipping</dt>
              <dd className="font-medium text-foreground">
                {Number(cart.totals.shippingTotal) === 0
                  ? 'Calculated at checkout'
                  : formatPrice(cart.totals.shippingTotal, cart.currencyCode)}
              </dd>
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex justify-between text-base">
                <dt className="font-semibold text-foreground">Total</dt>
                <dd className="font-semibold text-foreground">
                  {formatPrice(cart.totals.cartTotal, cart.currencyCode)}
                </dd>
              </div>
            </div>
          </dl>

          <Button
            render={<Link to="/checkout" search={{ step: 'address' }} />}
            variant="outline"
            className="mt-6 w-full"
          >
            Go to checkout
          </Button>
        </aside>
      </div>
    </main>
  )
}
