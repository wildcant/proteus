import { cn } from '@proteus/ui'
import { useCountryName } from '#/api/countries'
import type { StoreOrderAddress, StoreOrderResponseOrder } from '#/api/generated/model'
import { Panel } from '#/components/panel'
import { useFormatters } from '#/lib/use-formatters'

/**
 * The address in full — `address2`, `province` and `phone` included, and the country as a name.
 * The order a form produced should not print less than the form that captured it.
 *
 * One column at every width: this sits in a third of the grid above `lg`, so the three columns
 * it used to have were never going to be three columns.
 */
export function DeliveryDetails({ order }: { order: StoreOrderResponseOrder }) {
  const { formatPrice } = useFormatters()
  // Through the full ISO listing, not the markets the store sells in today: an order is a record
  // of where a parcel went, and the store closing a market later does not turn that country back
  // into a two-letter code on the shopper's receipt.
  const countryName = useCountryName()
  const address = order.shippingAddress
  const shippingMethod = order.shippingMethods[0]

  return (
    <Panel title="Delivery">
      {address ? (
        <div className="mt-6 flex flex-col gap-0.5 text-ink-muted text-sm">
          {addressLines(address, countryName).map(({ field, value }) => (
            <p key={field} className="m-0">
              {value}
            </p>
          ))}
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
            <span className="shrink-0 whitespace-nowrap font-medium text-ink text-sm tabular-nums">
              {formatPrice(shippingMethod.amount, order.currencyCode)}
            </span>
          </div>
        )}
        {/* Labelled, because unlabelled it sat directly under the shipping method and read as
            part of it — a third line of the delivery option rather than the address the
            confirmation went to. */}
        <p className={cn('text-ink-subtle text-xs uppercase tracking-widest', shippingMethod && 'mt-4')}>
          Confirmation sent to
        </p>
        <p className="wrap-break-word m-0 mt-1 text-ink-muted text-sm">{order.email}</p>
      </div>
    </Panel>
  )
}

type AddressLine = { field: string; value: string }

/**
 * Postal codes belong on the locality line, not orphaned below it. Printing `province` and
 * `postalCode` as separate paragraphs put "78701" on a line of its own under "Austin, TX", which
 * is not how anyone writes an address or how a courier reads one.
 *
 * Joined rather than templated so an address missing any one part closes the gap instead of
 * printing a stray comma — every field on `StoreOrderAddress` is nullable. Keyed by field rather
 * than by value, because two lines of an address are allowed to read the same.
 *
 * `countryName` is passed in rather than read here, so this stays the pure function it was: the
 * name now comes from a request, and a hook would make every caller of this a component.
 */
function addressLines(
  address: NonNullable<StoreOrderAddress>,
  countryName: (code: string | null | undefined) => string | undefined,
): AddressLine[] {
  const locality = [[address.city, address.province].filter(Boolean).join(', '), address.postalCode]
    .filter(Boolean)
    .join(' ')

  const lines: AddressLine[] = [
    { field: 'name', value: [address.firstName, address.lastName].filter(Boolean).join(' ') },
    { field: 'company', value: address.company ?? '' },
    { field: 'address1', value: address.address1 ?? '' },
    { field: 'address2', value: address.address2 ?? '' },
    { field: 'locality', value: locality },
    { field: 'country', value: countryName(address.countryCode) ?? '' },
    { field: 'phone', value: address.phone ?? '' },
  ]

  return lines.filter((line) => line.value !== '')
}
