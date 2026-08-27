import type { CheckoutData } from '../../hooks/use-checkout-data'
import type { CheckoutForm } from '../../hooks/use-checkout-form'
import { CheckoutSection } from '../checkout-section'
import { PaymentForm } from './payment-form'

type PaymentSectionProps = Pick<CheckoutData, 'cart'> & {
  form: CheckoutForm
}
export function PaymentSection(props: PaymentSectionProps) {
  return (
    <CheckoutSection title="Payment">
      <PaymentForm {...props} />
    </CheckoutSection>
  )
}
