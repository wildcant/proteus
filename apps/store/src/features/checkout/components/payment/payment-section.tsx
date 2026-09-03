import type { CheckoutData } from '../../hooks/use-checkout-data'
import type { CheckoutForm } from '../../hooks/use-checkout-form'
import { CheckoutSection } from '../checkout-section'
import { PaymentForm } from './payment-form'

type PaymentSectionProps = Pick<CheckoutData, 'cart' | 'customer'> & {
  form: CheckoutForm
}
export function PaymentSection({ form, cart, customer }: PaymentSectionProps) {
  return (
    <CheckoutSection title="Payment">
      <PaymentForm form={form} cart={cart} customer={customer} />
    </CheckoutSection>
  )
}
