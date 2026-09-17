import type { OrderTotals, PaymentStatus } from '@core/types/order/common.js'

export function computePaymentStatus(totals: OrderTotals): PaymentStatus {
  if (totals.outstandingTotal.isZero()) return 'captured'
  if (totals.paidTotal.isGreaterThan(0)) return 'authorized'
  return 'awaiting'
}
