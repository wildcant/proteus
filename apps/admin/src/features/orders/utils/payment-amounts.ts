import { msg } from '@lingui/core/macro'
import { AdminCancelOrder, AdminRecordOrderPayment, AdminRefundPayment } from '@proteus/http-schemas/admin'
import { getCurrencyPrecision } from '@proteus/utils'
import BigNumber from 'bignumber.js'
import type { AdminPayment } from '#/api/generated/model'

type RecordPaymentPrefillInput = {
  orderTotal: string
  outstandingTotal: string
  currencyCode: string
  /** No payment has been recorded on the Order yet, so this one is its deposit. */
  isFirstPayment: boolean
  /** The store's deposit share of the total, as a percentage; unset, there is no deposit. */
  depositPercentage: number | undefined
}

/**
 * The amount «Record payment» opens with: the store's deposit share of the total for the first
 * payment when the store takes deposits, otherwise what is still outstanding. Only the deposit
 * share is rounded, to the currency's precision, because only it is computed; the outstanding is
 * already an amount the Order owes.
 */
export function recordPaymentPrefill({
  orderTotal,
  outstandingTotal,
  currencyCode,
  isFirstPayment,
  depositPercentage,
}: RecordPaymentPrefillInput): string {
  if (!isFirstPayment || depositPercentage === undefined) return outstandingTotal

  return new BigNumber(orderTotal)
    .times(depositPercentage)
    .div(100)
    .decimalPlaces(getCurrencyPrecision(currencyCode), BigNumber.ROUND_HALF_UP)
    .toFixed()
}

/** What a payment can still give back: everything captured on it, less what was refunded already. */
export function refundableAmount(payment: Pick<AdminPayment, 'captures' | 'refunds'>): string {
  const captured = (payment.captures ?? []).reduce((sum, row) => sum.plus(row.amount), new BigNumber(0))
  const refunded = (payment.refunds ?? []).reduce((sum, row) => sum.plus(row.amount), new BigNumber(0))
  return captured.minus(refunded).toFixed()
}

const mustBePositive = msg`Enter an amount greater than zero.`.id
const mustNotBeNegative = msg`Enter an amount of zero or more.`.id
const overOutstanding = msg`The amount can't be more than what is outstanding.`.id
const overRefundable = msg`The amount can't be more than what this payment can refund.`.id
const overReceived = msg`The amount can't be more than what the order has received.`.id

/**
 * The route's own body schemas, bounded by what the Order allows, so the admin is told on the
 * field rather than by a refused request. The server checks the same bounds again.
 */
export const recordPaymentSchema = (outstandingTotal: string) =>
  AdminRecordOrderPayment.superRefine(({ amount }, ctx) => {
    if (!amount.isGreaterThan(0)) ctx.addIssue({ code: 'custom', path: ['amount'], message: mustBePositive })
    else if (amount.isGreaterThan(outstandingTotal))
      ctx.addIssue({ code: 'custom', path: ['amount'], message: overOutstanding })
  })

export const refundPaymentSchema = (refundable: string) =>
  AdminRefundPayment.pick({ amount: true, note: true })
    .required({ amount: true, note: true })
    .superRefine(({ amount }, ctx) => {
      if (!amount.isGreaterThan(0)) ctx.addIssue({ code: 'custom', path: ['amount'], message: mustBePositive })
      else if (amount.isGreaterThan(refundable))
        ctx.addIssue({ code: 'custom', path: ['amount'], message: overRefundable })
    })

/** At cancel the admin may keep everything received, so zero is a valid refund here. */
export const cancelOrderSchema = (paidTotal: string) =>
  AdminCancelOrder.unwrap()
    .required({ refundAmount: true })
    .superRefine(({ refundAmount }, ctx) => {
      if (refundAmount.isNegative())
        ctx.addIssue({ code: 'custom', path: ['refundAmount'], message: mustNotBeNegative })
      else if (refundAmount.isGreaterThan(paidTotal))
        ctx.addIssue({ code: 'custom', path: ['refundAmount'], message: overReceived })
    })

/** Canceling refunds everything received unless the admin says otherwise. */
export const cancelOrderDefaults = (paidTotal: string) => ({ refundAmount: paidTotal })
