import { z } from 'zod'
import { stringToBigNumber } from '../../common.js'

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
