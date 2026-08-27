import { Skeleton } from '@proteus/ui'
import { ShppingAddressPicker } from '#/features/checkout/components/delivery/shipping-address-picker'
import type { CheckoutData } from '#/features/checkout/hooks/use-checkout-data'
import type { CheckoutForm } from '../../hooks/use-checkout-form'
import { CheckoutSection } from '../checkout-section'
import { ShippingAddressForm } from './shipping-address-form'

type DeliverySectionProps = Pick<CheckoutData, 'cart' | 'addresses' | 'isAddressesLoading' | 'cartAddresses'> & {
  form: CheckoutForm
}

/** Confirm a saved address, or type one. A shopper is only ever offered one of the two. */
function Delivery({ cart, addresses, isAddressesLoading, form, cartAddresses }: DeliverySectionProps) {
  if (isAddressesLoading) return <Skeleton className="h-40 w-full" />
  if (addresses.length > 0 && cartAddresses) {
    return <ShppingAddressPicker form={form} cart={cart} addresses={addresses} cartAddresses={cartAddresses} />
  }
  return <ShippingAddressForm form={form} />
}

export function DeliverySection(props: DeliverySectionProps) {
  return (
    <CheckoutSection title="Delivery">
      <Delivery {...props} />
    </CheckoutSection>
  )
}
