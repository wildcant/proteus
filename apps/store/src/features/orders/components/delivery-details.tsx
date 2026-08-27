import { formatPrice } from '@proteus/ui'
import type { StoreOrderResponseOrder } from '#/api/generated/model'
import { countryName } from '#/components/form/countries'
import { Panel } from '#/components/panel'

/**
 * The address in full — `address2`, `province` and `phone` included, and the country as a name.
 * The order a form produced should not print less than the form that captured it.
 *
 * One column at every width: this sits in a third of the grid above `lg`, so the three columns
 * it used to have were never going to be three columns.
 */
export function DeliveryDetails({ order }: { order: StoreOrderResponseOrder }) {
  const address = order.shippingAddress
  const shippingMethod = order.shippingMethods[0]

  return (
    <Panel title="Delivery">
      {address ? (
        <div className="mt-6 flex flex-col gap-0.5 text-ink-muted text-sm">
          {!!(address.firstName || address.lastName) && (
            <p className="m-0">{[address.firstName, address.lastName].filter(Boolean).join(' ')}</p>
          )}
          {!!address.company && <p className="m-0">{address.company}</p>}
          {!!address.address1 && <p className="m-0">{address.address1}</p>}
          {!!address.address2 && <p className="m-0">{address.address2}</p>}
          {!!(address.city || address.province) && (
            <p className="m-0">{[address.city, address.province].filter(Boolean).join(', ')}</p>
          )}
          {!!address.postalCode && <p className="m-0">{address.postalCode}</p>}
          {!!address.countryCode && <p className="m-0">{countryName(address.countryCode)}</p>}
          {!!address.phone && <p className="m-0">{address.phone}</p>}
        </div>
      ) : (
        // Seeded and hand-placed orders always have one, which is what makes this the branch
        // most likely to be dropped. `shippingAddress` is nullable on the response.
        <p className="mt-6 text-ink-muted text-sm">No address provided</p>
      )}

      {/* The hairline separates the address from what was done with it. A digital-only order has
          no shipping method and drops that line; the rule stays, because the contact email under
          it is never absent — `email` is non-null on the order. */}
      <div className="mt-6 border-line border-t pt-6">
        {!!shippingMethod && (
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-ink text-sm">{shippingMethod.name}</span>
            <span className="shrink-0 font-medium text-ink text-sm tabular-nums">
              {formatPrice(shippingMethod.amount, order.currencyCode)}
            </span>
          </div>
        )}
        <p className={shippingMethod ? 'm-0 mt-2 text-ink-muted text-sm' : 'm-0 text-ink-muted text-sm'}>
          {order.email}
        </p>
      </div>
    </Panel>
  )
}
