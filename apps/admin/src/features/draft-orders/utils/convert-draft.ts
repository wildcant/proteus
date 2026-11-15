import { z } from 'zod'
import type { AdminConvertDraftOrder, AdminDraftOrderResponseDraftOrder } from '#/api/generated/model'
import { recordPaymentPrefill, recordPaymentSchema } from '#/features/orders/utils/payment-amounts'

export type ConvertDraftValues = {
  /** Off, the draft converts unpaid and its payments are recorded on the Order later. */
  recordPayment: boolean
  amount: string
}

type ConvertDraftOrder = Pick<AdminDraftOrderResponseDraftOrder, 'totals' | 'currencyCode'>

/**
 * Opens on the deposit when the store takes one: its share of the total, as «Record payment»
 * opens an Order's first payment. A store without a deposit share converts unpaid by default, with
 * the amount ready at the full total should the admin switch the payment on.
 */
export function convertDraftDefaults(
  draftOrder: ConvertDraftOrder,
  depositPercentage: number | undefined,
): ConvertDraftValues {
  return {
    recordPayment: depositPercentage !== undefined,
    amount: recordPaymentPrefill({
      orderTotal: draftOrder.totals.orderTotal,
      outstandingTotal: draftOrder.totals.outstandingTotal,
      currencyCode: draftOrder.currencyCode,
      isFirstPayment: true,
      depositPercentage,
    }),
  }
}

/** The payment, when recorded, follows «Record payment»'s bounds: more than nothing, at most what is owed. */
export const convertDraftSchema = (outstandingTotal: string) =>
  z.object({ recordPayment: z.boolean(), amount: z.string() }).superRefine(({ recordPayment, amount }, ctx) => {
    if (!recordPayment) return
    const payment = recordPaymentSchema(outstandingTotal).safeParse({ amount })
    for (const issue of payment.error?.issues ?? []) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: issue.message })
    }
  })

/** No payment means no body field at all, which the route reads as "convert unpaid". */
export function convertDraftPayload(values: ConvertDraftValues): AdminConvertDraftOrder | undefined {
  if (!values.recordPayment) return undefined
  return { paymentAmount: values.amount.trim() }
}
