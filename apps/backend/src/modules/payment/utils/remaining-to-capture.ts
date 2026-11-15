import { BigNumber } from '../../../core/bignumber.js'
import type { PaymentDTO } from '../../../core/types/payment/common.js'

/** What a payment's authorization still holds once its captures are taken out. */
export function remainingToCapture(payment: PaymentDTO): BigNumber {
  const captured = (payment.captures ?? []).reduce((sum, capture) => sum.plus(capture.amount), new BigNumber(0))
  return payment.amount.minus(captured)
}
