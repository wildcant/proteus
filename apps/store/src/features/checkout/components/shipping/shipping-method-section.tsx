import { useLingui } from '@lingui/react/macro'
import { CheckoutSection } from '#/features/checkout/components/checkout-section/checkout-section'
import { ShippingMethodForm } from '#/features/checkout/components/shipping-method-form/shipping-method-form'
import type { CheckoutData } from '#/features/checkout/hooks/use-checkout-data'
import type { CheckoutForm } from '#/features/checkout/hooks/use-checkout-form'

type ShippingMethodSectionProps = Pick<CheckoutData, 'cart' | 'isAddressesLoading'> & {
  form: CheckoutForm
  className?: string
  /** The section body's content, the caller's layer. */
  contentClassName?: string
}
export function ShippingMethodSection({ className, contentClassName, ...props }: ShippingMethodSectionProps) {
  const { t } = useLingui()
  return (
    <CheckoutSection title={t`Shipping method`} className={className}>
      <ShippingMethodForm {...props} className={contentClassName} />
    </CheckoutSection>
  )
}
