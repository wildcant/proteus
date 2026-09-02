import { z } from 'zod'
import { stringToBigNumber } from '../../common.js'

/**
 * A capture takes the whole authorization, so there is nothing to say about it.
 *
 * Strict rather than merely empty: a caller sending `amount` believes it is capturing part of
 * the authorization, and no gateway adapter here can do that — Stripe's capture call carries no
 * `amount_to_capture`, so the shopper is charged the full intent whatever the number says. Such
 * a request has to fail loudly; accepting and ignoring the field is the defect being removed.
 */
export const AdminCapturePayment = z.strictObject({}).openapi('AdminCapturePayment')
export type AdminCapturePaymentBody = z.infer<typeof AdminCapturePayment>

export const AdminRefundPayment = z
  .object({
    amount: stringToBigNumber.optional(),
    refundReasonId: z.string().min(1).optional(),
    note: z.string().optional(),
  })
  .openapi('AdminRefundPayment')
export type AdminRefundPaymentBody = z.infer<typeof AdminRefundPayment>

export const AdminCreateRefundReason = z
  .object({
    label: z.string().min(1),
    code: z.string().min(1),
    description: z.string().optional(),
  })
  .openapi('AdminCreateRefundReason')
export type AdminCreateRefundReasonBody = z.infer<typeof AdminCreateRefundReason>
