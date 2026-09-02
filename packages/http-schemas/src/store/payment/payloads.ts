import { z } from 'zod'
import { stringToBigNumber } from '../../common.js'

export const CreatePaymentSession = z.object({
  providerId: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})
export type CreatePaymentSessionBody = z.infer<typeof CreatePaymentSession>

/**
 * Deliberately empty, and deliberately not `strictObject`.
 *
 * The amount is priced server-side from the cart; the browser has nothing to say about it. A
 * client that sends one anyway has it stripped here rather than rejected, so an older storefront
 * cannot break checkout by being polite about a field that no longer exists.
 */
export const UpdatePaymentSession = z.object({}).default({})
export type UpdatePaymentSessionBody = z.infer<typeof UpdatePaymentSession>

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

export const SessionIdParams = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
})
export type SessionIdParams = z.infer<typeof SessionIdParams>

export const ProviderParams = z.object({ provider: z.string().min(1) })
export type ProviderParams = z.infer<typeof ProviderParams>
