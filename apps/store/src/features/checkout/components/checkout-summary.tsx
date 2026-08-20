import { formatPrice, Separator } from '@proteus/ui'
import { ShoppingBagIcon } from 'lucide-react'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'

type CheckoutSummaryProps = {
  cart: StoreCartDetailResponseCart
}

export function CheckoutSummary({ cart }: CheckoutSummaryProps) {
  return (
    <aside className="sticky top-8 h-fit rounded-lg border border-border p-6">
      <h2 className="mb-4 font-semibold text-foreground text-lg">In your cart</h2>

      <div className="space-y-3">
        {cart.items.map((item) => (
          <div key={item.id} className="flex gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-(--bg-subtle)">
              {item.thumbnail ? (
                <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-(--foreground-muted)">
                  <ShoppingBagIcon className="h-4 w-4" />
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 items-start justify-between">
              <div>
                <p className="font-medium text-foreground text-sm">{item.title}</p>
                {!!item.variantTitle && <p className="text-(--foreground-muted) text-xs">{item.variantTitle}</p>}
                <p className="text-(--foreground-muted) text-xs">Qty: {item.quantity}</p>
              </div>
              <span className="font-medium text-foreground text-sm">
                {formatPrice(item.lineTotal, cart.currencyCode)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <Separator className="my-4" />

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-(--foreground-muted)">Subtotal</dt>
          <dd className="font-medium text-foreground">{formatPrice(cart.totals.itemsTotal, cart.currencyCode)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-(--foreground-muted)">Shipping</dt>
          <dd className="font-medium text-foreground">
            {Number(cart.totals.shippingTotal) === 0
              ? 'Calculated at next step'
              : formatPrice(cart.totals.shippingTotal, cart.currencyCode)}
          </dd>
        </div>
        <Separator className="my-2" />
        <div className="flex justify-between text-base">
          <dt className="font-semibold text-foreground">Total</dt>
          <dd className="font-semibold text-foreground">{formatPrice(cart.totals.cartTotal, cart.currencyCode)}</dd>
        </div>
      </dl>
    </aside>
  )
}
