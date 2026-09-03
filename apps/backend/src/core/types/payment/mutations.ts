import type { BigNumber } from '../../bignumber.js'
import type { PaymentActions, PaymentSessionStatus } from './common.js'

// ---------------------------------------------------------------------------
// PaymentCollection
// ---------------------------------------------------------------------------

export type CreatePaymentCollectionDTO = {
  amount: BigNumber
  currencyCode?: string
  metadata?: Record<string, unknown> | null
}

export type UpdatePaymentCollectionDTO = {
  amount?: BigNumber
  currencyCode?: string
  metadata?: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// PaymentSession
// ---------------------------------------------------------------------------

export type CreatePaymentSessionDTO = {
  providerId: string
  amount: BigNumber
  currencyCode?: string | undefined
  data?: Record<string, unknown> | undefined
  context?: Record<string, unknown> | undefined
}

export type UpdatePaymentSessionDTO = {
  amount?: BigNumber
  currencyCode?: string
  data?: Record<string, unknown>
  metadata?: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

export type CreatePaymentDTO = {
  paymentCollectionId: string
  paymentSessionId: string
  amount: BigNumber
  currencyCode: string
  providerId: string
  data?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

export type CreateCaptureDTO = {
  paymentId: string
  amount?: BigNumber | undefined
  capturedBy?: string | undefined
}

// ---------------------------------------------------------------------------
// Refund
// ---------------------------------------------------------------------------

export type CreateRefundDTO = {
  paymentId: string
  amount?: BigNumber | undefined
  refundReasonId?: string | undefined
  note?: string | undefined
  createdBy?: string | undefined
}

// ---------------------------------------------------------------------------
// RefundReason
// ---------------------------------------------------------------------------

export type CreateRefundReasonDTO = {
  label: string
  code: string
  description?: string | null | undefined
  metadata?: Record<string, unknown> | null | undefined
}

export type UpdateRefundReasonDTO = {
  label?: string
  code?: string
  description?: string | null
  metadata?: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// PaymentProvider
// ---------------------------------------------------------------------------

export type CreatePaymentProviderDTO = {
  id: string
  isEnabled?: boolean
}

// ---------------------------------------------------------------------------
// AccountHolder
// ---------------------------------------------------------------------------

export type CreateAccountHolderDTO = {
  providerId: string
  externalId: string
  email?: string | null
  data?: Record<string, unknown>
  metadata?: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// PaymentMethod (provider-managed, no DB table)
// ---------------------------------------------------------------------------

export type CreatePaymentMethodDTO = {
  providerId: string
  data: Record<string, unknown>
  context: Record<string, unknown>
}

export type DeletePaymentMethodDTO = {
  id: string
  providerId: string
  data?: Record<string, unknown>
  context?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export type ProviderWebhookPayload = {
  provider: string
  payload: {
    data: Record<string, unknown>
    rawData: string | Buffer
    headers: Record<string, string>
  }
}

export type WebhookActionResult = {
  action: PaymentActions
  data?: {
    sessionId: string
    amount: BigNumber
  }
}

// ---------------------------------------------------------------------------
// Provider input/output types
// ---------------------------------------------------------------------------

export type InitiatePaymentInput = {
  amount: BigNumber
  currencyCode: string
  data?: Record<string, unknown> | undefined
  context?: Record<string, unknown> | undefined
}

export type InitiatePaymentOutput = {
  id: string
  data?: Record<string, unknown>
  status?: PaymentSessionStatus
}

export type AuthorizePaymentInput = {
  data?: Record<string, unknown> | undefined
  context?: Record<string, unknown> | undefined
}

export type AuthorizePaymentOutput = {
  status: PaymentSessionStatus
  data?: Record<string, unknown>
}

export type CapturePaymentInput = {
  data?: Record<string, unknown> | undefined
  context?: Record<string, unknown> | undefined
}

export type CapturePaymentOutput = {
  data?: Record<string, unknown>
}

export type CancelPaymentInput = {
  data?: Record<string, unknown> | undefined
  context?: Record<string, unknown> | undefined
}

export type CancelPaymentOutput = {
  data?: Record<string, unknown>
}

export type DeletePaymentInput = {
  data?: Record<string, unknown>
  context?: Record<string, unknown>
}

export type DeletePaymentOutput = {
  data?: Record<string, unknown>
}

export type RefundPaymentInput = {
  amount: BigNumber
  data?: Record<string, unknown> | undefined
  context?: Record<string, unknown> | undefined
}

export type RefundPaymentOutput = {
  data?: Record<string, unknown>
}

export type RetrievePaymentInput = {
  data?: Record<string, unknown>
  context?: Record<string, unknown>
}

export type RetrievePaymentOutput = {
  data?: Record<string, unknown>
}

export type UpdatePaymentInput = {
  amount?: BigNumber
  currencyCode?: string
  data?: Record<string, unknown>
  context?: Record<string, unknown>
}

export type UpdatePaymentOutput = {
  data?: Record<string, unknown>
}

export type GetPaymentStatusInput = {
  data?: Record<string, unknown>
  context?: Record<string, unknown>
}

export type GetPaymentStatusOutput = {
  status: PaymentSessionStatus
}

export type CreateAccountHolderInput = {
  data?: Record<string, unknown> | undefined
  context?: Record<string, unknown> | undefined
}

export type CreateAccountHolderOutput = {
  id: string
  data?: Record<string, unknown>
}

export type DeleteAccountHolderInput = {
  data?: Record<string, unknown>
  context?: Record<string, unknown>
}

export type DeleteAccountHolderOutput = {
  data?: Record<string, unknown>
}

export type ListPaymentMethodsInput = {
  context?: Record<string, unknown>
}

export type ListPaymentMethodsOutput = {
  id: string
  data?: Record<string, unknown>
}[]

export type SavePaymentMethodInput = {
  data?: Record<string, unknown>
  context?: Record<string, unknown>
}

export type SavePaymentMethodOutput = {
  id: string
  data?: Record<string, unknown>
}

export type DeletePaymentMethodInput = {
  data?: Record<string, unknown> | undefined
  context?: Record<string, unknown> | undefined
}

export type DeletePaymentMethodOutput = Record<string, unknown>
