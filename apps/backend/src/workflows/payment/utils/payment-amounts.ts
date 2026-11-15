import { BigNumber } from '@core/bignumber.js'
import type { PaymentDTO } from '@core/types/payment/common.js'

function sumAmounts(rows: { amount: BigNumber }[]): BigNumber {
  return rows.reduce((sum, row) => sum.plus(row.amount), new BigNumber(0))
}

/** Everything captured across the payments, read from their capture rows. */
export function capturedAcross(payments: PaymentDTO[]): BigNumber {
  return sumAmounts(payments.flatMap((payment) => payment.captures ?? []))
}

/** What a payment received and has not returned: its captures less its refunds. */
export function receivedBy(payment: PaymentDTO): BigNumber {
  return capturedAcross([payment]).minus(sumAmounts(payment.refunds ?? []))
}
