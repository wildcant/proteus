import { z } from 'zod'
import { entityId, longText, machineCode, shortText } from '../../bounded.js'
import { amountToBigNumber } from '../../common.js'

export const AdminCapturePayment = z
  .object({
    amount: amountToBigNumber.optional(),
  })
  .openapi('AdminCapturePayment')
export type AdminCapturePaymentBody = z.infer<typeof AdminCapturePayment>

export const AdminRefundPayment = z
  .object({
    amount: amountToBigNumber.optional(),
    refundReasonId: entityId.min(1).optional(),
    note: longText.optional(),
  })
  .openapi('AdminRefundPayment')
export type AdminRefundPaymentBody = z.infer<typeof AdminRefundPayment>

export const AdminCreateRefundReason = z
  .object({
    label: shortText.min(1),
    code: machineCode.min(1),
    description: longText.optional(),
  })
  .openapi('AdminCreateRefundReason')
export type AdminCreateRefundReasonBody = z.infer<typeof AdminCreateRefundReason>
