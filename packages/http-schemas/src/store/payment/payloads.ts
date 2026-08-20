import { z } from 'zod'
import { stringToBigNumber } from '../../common.js'

export const CreatePaymentSession = z.object({
  providerId: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})
export type CreatePaymentSessionBody = z.infer<typeof CreatePaymentSession>

export const CreatePaymentCollection = z.object({
  cartId: z.string().min(1),
})
export type CreatePaymentCollectionBody = z.infer<typeof CreatePaymentCollection>

export const CapturePayment = z.object({
  amount: stringToBigNumber.optional(),
})
export type CapturePaymentBody = z.infer<typeof CapturePayment>

export const RefundPayment = z.object({
  amount: stringToBigNumber.optional(),
  refundReasonId: z.string().min(1).optional(),
  note: z.string().optional(),
})
export type RefundPaymentBody = z.infer<typeof RefundPayment>

export const CreateRefundReason = z.object({
  label: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
})
export type CreateRefundReasonBody = z.infer<typeof CreateRefundReason>

export const ProviderParams = z.object({ provider: z.string().min(1) })
export type ProviderParams = z.infer<typeof ProviderParams>
