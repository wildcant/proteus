import { formatPrice } from '@proteus/ui'
import type { StoreOrderResponseOrder } from '#/api/generated/model'

export function DeliveryDetails({ order }: { order: StoreOrderResponseOrder }) {
  const address = order.shippingAddress
  const shippingMethod = order.shippingMethods[0]

  return (
    <section>
      <h3 className="font-bold text-foreground text-xl">Delivery</h3>

      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div>
          <p className="font-semibold text-foreground text-sm">Shipping Address</p>
          {address ? (
            <div className="mt-1 text-(--foreground-muted) text-sm">
              {!!(address.firstName || address.lastName) && (
                <p>{[address.firstName, address.lastName].filter(Boolean).join(' ')}</p>
              )}
              {!!address.address1 && <p>{address.address1}</p>}
              {!!(address.postalCode || address.city) && (
                <p>{[address.postalCode, address.city].filter(Boolean).join(', ')}</p>
              )}
              {!!address.countryCode && <p>{address.countryCode.toUpperCase()}</p>}
            </div>
          ) : (
            <p className="mt-1 text-(--foreground-muted) text-sm">No address provided</p>
          )}
        </div>

        <div>
          <p className="font-semibold text-foreground text-sm">Contact</p>
          {!!order.email && <p className="mt-1 text-(--foreground-muted) text-sm">{order.email}</p>}
        </div>

        <div>
          <p className="font-semibold text-foreground text-sm">Method</p>
          {!!shippingMethod && (
            <p className="mt-1 text-(--foreground-muted) text-sm">
              {shippingMethod.name} ({formatPrice(shippingMethod.amount, order.currencyCode)})
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
