import { useLingui } from '@lingui/react/macro'
import { CheckoutSection } from '#/features/checkout/components/checkout-section/checkout-section'
import { PaymentForm } from '#/features/checkout/components/payment-form/payment-form'
import type { CheckoutData } from '#/features/checkout/hooks/use-checkout-data'
import type { CheckoutForm } from '#/features/checkout/hooks/use-checkout-form'

type PaymentSectionProps = Pick<CheckoutData, 'cart' | 'customer'> & {
  form: CheckoutForm
  className?: string
  /** The section body's content, the caller's layer. */
  contentClassName?: string
}
export function PaymentSection({ form, cart, customer, className, contentClassName }: PaymentSectionProps) {
  const { t } = useLingui()
  return (
    <CheckoutSection title={t`Payment`} className={className}>
      <PaymentForm form={form} cart={cart} customer={customer} className={contentClassName} />
    </CheckoutSection>
  )
}
