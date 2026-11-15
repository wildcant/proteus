import type { BigNumber } from '../../bignumber.js'
import type { PaymentActions, PaymentSessionStatus, SavedMethodDTO } from './common.js'

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
// Capture
// ---------------------------------------------------------------------------

export type CreateCaptureDTO = {
  paymentId: string
  /** Omitted, the capture takes everything the authorization still holds. */
  amount?: BigNumber | undefined
  capturedBy?: string | undefined
  /** A capture already recorded under this key is answered with, not taken again. */
  idempotencyKey?: string | undefined
}

/** A capture against a collection rather than a payment: what recording a payment on an Order is. */
export type CapturePaymentCollectionDTO = {
  amount: BigNumber
  capturedBy?: string | undefined
  /** A capture already recorded under this key is answered with, not taken again. */
  idempotencyKey?: string | undefined
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
  /** A refund already recorded under this key is answered with, not made again. */
  idempotencyKey?: string | undefined
}

export type CancelPaymentDTO = {
  /**
   * What the caller saw captured on the payment's collection when it decided to cancel. Checked
   * under the collection's lock: a capture recorded since then refuses the cancel, so money taken
   * in between is never left on a canceled Order unaccounted for.
   */
  capturedAmount?: BigNumber | undefined
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
  /** The Proteus Customer this holder belongs to. What `ensureAccountHolders` looks it up by. */
  customerId?: string | null
  email?: string | null
  data?: Record<string, unknown>
  metadata?: Record<string, unknown> | null
}

/**
 * What an account holder is created *from*, when nobody knows yet whether one exists.
 *
 * No `externalId`: the gateway assigns it, and the whole point of this operation is that the
 * caller does not have to know whether the gateway has been asked before.
 */
export type EnsureAccountHoldersDTO = {
  customerId: string
  email?: string | null
  name?: string | null
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export type ProviderWebhookPayload = {
  provider: string
  payload: {
    data: Record<string, unknown>
    /** The unmodified request body bytes, as the gateway sent and signed them. */
    rawData: string | Uint8Array
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
  /** What this capture takes. Only a provider declaring `canCapturePartially` is handed less than the authorization. */
  amount: BigNumber
  currencyCode: string
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

export type RefundPaymentInput = {
  amount: BigNumber
  /** The payment's currency. A provider counting in a smallest unit needs it to convert. */
  currencyCode: string
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

/**
 * The neutral projection, not the gateway's objects.
 *
 * The adapter is the only thing that can read a `Stripe.PaymentMethod`, so it is also the only
 * thing that should: handing the blob upwards is what puts `card.brand` in a route and a raw
 * gateway field in a response body.
 */
export type ListPaymentMethodsOutput = SavedMethodDTO[]

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

export type SetDefaultPaymentMethodInput = {
  data?: Record<string, unknown> | undefined
  context?: Record<string, unknown> | undefined
}

export type SetDefaultPaymentMethodOutput = Record<string, unknown>
