import { cn } from '@proteus/ui-core'
import {
  paymentErrorAlert,
  paymentErrorAlertMessage,
} from '#/features/checkout/components/payment-error-alert/payment-error-alert.variants'

/**
 * A decline, beneath the Place order button rather than under a field: a decline is not something
 * the shopper mistyped, and the press that produced it is what they are looking at.
 */
export function PaymentErrorAlert({ message, className }: { message: string; className?: string }) {
  return (
    <div role="alert" className={cn(paymentErrorAlert(), className)}>
      <p className={paymentErrorAlertMessage()}>{message}</p>
    </div>
  )
}
