import { BigNumber } from '../../../core/bignumber.js'
import type { PaymentDTO } from '../../../core/types/payment/common.js'

/** The sum of the rows' amounts: captures, refunds or sessions alike. */
export function sumAmounts(rows: { amount: BigNumber }[]): BigNumber {
  return rows.reduce((sum, row) => sum.plus(row.amount), new BigNumber(0))
}

/** Everything captured across the payments, read from their capture rows. */
export function capturedTotal(payments: PaymentDTO[]): BigNumber {
  return sumAmounts(payments.flatMap((payment) => payment.captures ?? []))
}

/** Everything refunded across the payments, read from their refund rows. */
export function refundedTotal(payments: PaymentDTO[]): BigNumber {
  return sumAmounts(payments.flatMap((payment) => payment.refunds ?? []))
}

/** What a payment's authorization still holds once its captures are taken out. */
export function remainingToCapture(payment: PaymentDTO): BigNumber {
  return payment.amount.minus(capturedTotal([payment]))
}
