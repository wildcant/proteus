import { useLingui } from '@lingui/react/macro'
import { Skeleton } from '#/components/ui/skeleton/skeleton'
import { CheckoutSection } from '#/features/checkout/components/checkout-section/checkout-section'
import { ShippingAddressForm } from '#/features/checkout/components/shipping-address-form/shipping-address-form'
import { ShippingAddressPicker } from '#/features/checkout/components/shipping-address-picker/shipping-address-picker'
import type { CheckoutData } from '#/features/checkout/hooks/use-checkout-data'
import type { CheckoutForm } from '#/features/checkout/hooks/use-checkout-form'

type DeliveryProps = Pick<CheckoutData, 'cart' | 'addresses' | 'isAddressesLoading' | 'cartAddresses'> & {
  form: CheckoutForm
  /** The section body's content, the caller's layer. */
  contentClassName?: string
}

type DeliverySectionProps = DeliveryProps & { className?: string }

/** Confirm a saved address, or type one. A shopper is only ever offered one of the two. */
function Delivery({ cart, addresses, isAddressesLoading, form, cartAddresses, contentClassName }: DeliveryProps) {
  if (isAddressesLoading) return <Skeleton className="h-40 w-full" />
  if (addresses.length > 0 && cartAddresses) {
    return (
      <ShippingAddressPicker
        form={form}
        cart={cart}
        addresses={addresses}
        cartAddresses={cartAddresses}
        className={contentClassName}
      />
    )
  }
  return <ShippingAddressForm form={form} className={contentClassName} />
}

export function DeliverySection({ className, ...props }: DeliverySectionProps) {
  const { t } = useLingui()
  return (
    <CheckoutSection title={t`Delivery`} className={className}>
      <Delivery {...props} />
    </CheckoutSection>
  )
}
