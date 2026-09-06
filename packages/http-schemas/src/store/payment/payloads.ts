import { z } from 'zod'
import { entityId, longText, machineCode, shortText } from '../../bounded.js'
import { amountToBigNumber } from '../../common.js'

export const CreatePaymentSession = z.object({
  providerId: entityId.min(1),
  data: z.record(z.string(), z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})
export type CreatePaymentSessionBody = z.infer<typeof CreatePaymentSession>

export const CreatePaymentCollection = z.object({
  cartId: entityId.min(1),
})
export type CreatePaymentCollectionBody = z.infer<typeof CreatePaymentCollection>

export const CapturePayment = z.object({
  amount: amountToBigNumber.optional(),
})
export type CapturePaymentBody = z.infer<typeof CapturePayment>

export const RefundPayment = z.object({
  amount: amountToBigNumber.optional(),
  refundReasonId: entityId.min(1).optional(),
  note: longText.optional(),
})
export type RefundPaymentBody = z.infer<typeof RefundPayment>

export const CreateRefundReason = z.object({
  label: shortText.min(1),
  code: machineCode.min(1),
  description: longText.optional(),
})
export type CreateRefundReasonBody = z.infer<typeof CreateRefundReason>

export const ProviderParams = z.object({ provider: machineCode.min(1) })
export type ProviderParams = z.infer<typeof ProviderParams>
