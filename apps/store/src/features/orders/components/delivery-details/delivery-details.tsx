import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { useCountryName } from '#/api/countries'
import type { StoreOrderAddress, StoreOrderDetail, StoreOrderLocality } from '#/api/generated/model'
import { Panel } from '#/components/store/panel/panel'
import {
  deliveryDetails,
  deliveryDetailsAddress,
  deliveryDetailsConfirmation,
  deliveryDetailsConfirmationLabel,
  deliveryDetailsEmail,
  deliveryDetailsLine,
  deliveryDetailsMethod,
  deliveryDetailsMethodAmount,
  deliveryDetailsMethodName,
  deliveryDetailsPanel,
  deliveryDetailsShipping,
} from '#/features/orders/components/delivery-details/delivery-details.variants'
import { useFormatters } from '#/hooks/use-formatters'

/**
 * The address in full — `address2`, `province` and `phone` included, and the country as a name.
 * The order a form produced should not print less than the form that captured it. Only the
 * customer who placed the order reads it in full (`owner`); anyone else holding the order's link
 * reads its city and province.
 *
 * One column at every width: this sits in a third of the grid above `lg`, so the three columns
 * it used to have were never going to be three columns.
 */
export function DeliveryDetails({ order, className }: { order: StoreOrderDetail; className?: string }) {
  const { t } = useLingui()
  const { formatPrice } = useFormatters()
  // Through the full ISO listing, not the markets the store sells in today: an order is a record
  // of where a parcel went, and the store closing a market later does not turn that country back
  // into a two-letter code on the shopper's receipt.
  const countryName = useCountryName()
  const address = order.owner?.shippingAddress ?? order.shippingAddress
  const email = order.owner?.email
  const shippingMethod = order.shippingMethods[0]

  return (
    <Panel title={t`Delivery`} className={cn(deliveryDetails(), deliveryDetailsPanel(), className)}>
      <div className={deliveryDetailsAddress()}>
        {address ? (
          addressLines(address, countryName).map(({ field, value }) => (
            <p key={field} className={deliveryDetailsLine()}>
              {value}
            </p>
          ))
        ) : (
          // Seeded and hand-placed orders always have one, which is what makes this the branch
          // most likely to be dropped. `shippingAddress` is nullable on the response.
          <p className={deliveryDetailsLine()}>
            <Trans>No address provided</Trans>
          </p>
        )}
      </div>

      {/* The hairline separates the address from what was done with it. A digital-only order has
          no shipping method and drops that line, and a reader who is not the order's customer
          sees no email under it. */}
      <div className={deliveryDetailsShipping()}>
        {!!shippingMethod && (
          <div className={deliveryDetailsMethod()}>
            <span className={deliveryDetailsMethodName()}>{shippingMethod.name}</span>
            <span className={cn(deliveryDetailsMethodAmount(), 'shrink-0 whitespace-nowrap tabular-nums')}>
              {formatPrice(shippingMethod.amount, order.currencyCode)}
            </span>
          </div>
        )}
        {/* Labelled, because unlabelled it sat directly under the shipping method and read as
            part of it — a third line of the delivery option rather than the address the
            confirmation went to. */}
        {!!email && (
          <div className={deliveryDetailsConfirmation()}>
            <p className={deliveryDetailsConfirmationLabel()}>
              <Trans>Confirmation sent to</Trans>
            </p>
            <p className={cn(deliveryDetailsEmail(), 'wrap-break-word')}>{email}</p>
          </div>
        )}
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
 * printing a stray comma — every field on `StoreOrderAddress` is nullable, and a locality has
 * none but the city and province. Keyed by field rather
 * than by value, because two lines of an address are allowed to read the same.
 *
 * `countryName` is passed in rather than read here, so this stays the pure function it was: the
 * name now comes from a request, and a hook would make every caller of this a component.
 */
function addressLines(
  address: NonNullable<StoreOrderLocality> & Partial<NonNullable<StoreOrderAddress>>,
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
