import type { CheckoutData } from '../../hooks/use-checkout-data'
import type { CheckoutForm } from '../../hooks/use-checkout-form'
import { CheckoutSection } from '../checkout-section'
import { ShippingMethodForm } from './shipping-method-form'

type ShippingMethodSectionProps = Pick<CheckoutData, 'cart' | 'isAddressesLoading'> & {
  form: CheckoutForm
}
export function ShippingMethodSection(props: ShippingMethodSectionProps) {
  return (
    <CheckoutSection title="Shipping method">
      <ShippingMethodForm {...props} />
    </CheckoutSection>
  )
}
