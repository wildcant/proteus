import type { BigNumber } from '../../bignumber.js'
import type { BaseFilterable, OperatorMap } from '../common.js'

// ---------------------------------------------------------------------------
// Status enums
// ---------------------------------------------------------------------------

export type PaymentCollectionStatus = 'not_paid' | 'awaiting' | 'authorized' | 'partially_authorized' | 'completed'

export type PaymentSessionStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'requires_more'
  | 'error'
  | 'canceled'
  | 'pending_authorization'

/**
 * The statuses that mean the provider did not authorize. Narrower than [PaymentSessionStatus] so a
 * caller classifying the refusal covers exactly the reachable ones and no unreachable ones.
 */
export type UnauthorizedSessionStatus = Exclude<
  PaymentSessionStatus,
  'authorized' | 'captured' | 'pending_authorization'
>

export type PaymentActions =
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'pending'
  | 'requires_more'
  | 'canceled'
  | 'not_supported'
  | 'pending_authorization'

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export type PaymentCollectionDTO = {
  id: string
  currencyCode: string
  amount: BigNumber
  authorizedAmount: BigNumber | null
  capturedAmount: BigNumber | null
  refundedAmount: BigNumber | null
  completedAt: Date | null
  status: PaymentCollectionStatus
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  paymentSessions?: PaymentSessionDTO[]
  payments?: PaymentDTO[]
}

export type PaymentSessionDTO = {
  id: string
  paymentCollectionId: string
  providerId: string
  currencyCode: string
  amount: BigNumber
  status: PaymentSessionStatus
  data: Record<string, unknown>
  context: Record<string, unknown> | null
  authorizedAt: Date | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  payment?: PaymentDTO
}

export type PaymentDTO = {
  id: string
  paymentCollectionId: string
  paymentSessionId: string
  amount: BigNumber
  currencyCode: string
  providerId: string
  data: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  capturedAt: Date | null
  canceledAt: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  captures?: CaptureDTO[]
  refunds?: RefundDTO[]
}

/**
 * What an authorization attempt came back as.
 *
 * Three outcomes rather than two, because "the provider has not decided yet" and "the provider
 * said no" ask the caller for opposite things: one is money in flight that a later webhook will
 * resolve, the other is a shopper who did not pay. Both used to be `null`, so cart completion
 * could only answer both with the same terminal error — and an intent still settling unwound a
 * checkout as if the card had been declined, while the money kept settling at the gateway.
 *
 * The payment hangs off the `authorized` member alone, so there is no branch in which a caller
 * can read one that does not exist.
 */
export type AuthorizePaymentSessionResult =
  | { outcome: 'authorized'; payment: PaymentDTO }
  /** Confirmed at the provider and still settling. No payment yet; the webhook brings one. */
  | { outcome: 'pending_authorization' }
  /** Declined, cancelled, or still waiting on the shopper. `sessionStatus` says which. */
  | { outcome: 'not_authorized'; sessionStatus: UnauthorizedSessionStatus }

export type CaptureDTO = {
  id: string
  paymentId: string
  amount: BigNumber
  createdBy: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
}

export type RefundDTO = {
  id: string
  paymentId: string
  refundReasonId: string | null
  amount: BigNumber
  note: string | null
  createdBy: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
}

export type RefundReasonDTO = {
  id: string
  label: string
  code: string
  description: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

/**
 * What the storefront is told about a provider beyond its row: the label and test-only flag from
 * the provider class, and the client-safe configuration its adapter boots from.
 */
export type PaymentProviderMeta = {
  label: string
  isTestOnly: boolean
  /** Allowlisted, publishable values only. Empty for a provider with nothing to publish. */
  publicConfig: Record<string, unknown>
}

export type PaymentProviderDTO = {
  id: string
  isEnabled: boolean
}

export type AccountHolderDTO = {
  id: string
  providerId: string
  /** The Proteus Customer this holder stands for. Null for a holder created without one. */
  customerId: string | null
  externalId: string
  email: string | null
  data: Record<string, unknown>
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type PaymentMethodDTO = {
  id: string
  data: Record<string, unknown>
  providerId: string
}

/**
 * A stored card, in the checkout's vocabulary rather than a gateway's.
 *
 * Every field here is one any card network answers for, which is what lets the storefront render
 * a Stripe wallet and a Mercado Pago one with the same row component. The gateway's own object
 * stops at the adapter: nothing above it can leak a raw field because nothing above it is given
 * one.
 *
 * `createdAt` is the exception that is not shown — it exists so the wallet has one definition of
 * "most recent" to order by. `orderSavedMethods` is that definition, and it is applied once.
 */
export type SavedMethodDTO = {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  /** The default the *gateway* holds, not one Proteus stores. See `setDefaultPaymentMethod`. */
  isDefault: boolean
  /** When the gateway says the method was stored. Ordering only; never served to a storefront. */
  createdAt: Date
}

// ---------------------------------------------------------------------------
// Filterable types
// ---------------------------------------------------------------------------

export interface FilterablePaymentCollectionProps extends BaseFilterable<FilterablePaymentCollectionProps> {
  id?: string | string[]
  status?: PaymentCollectionStatus | PaymentCollectionStatus[]
  createdAt?: OperatorMap<Date>
  updatedAt?: OperatorMap<Date>
}

export interface FilterablePaymentSessionProps extends BaseFilterable<FilterablePaymentSessionProps> {
  id?: string | string[]
  paymentCollectionId?: string | string[]
  providerId?: string | string[]
  status?: PaymentSessionStatus | PaymentSessionStatus[]
  createdAt?: OperatorMap<Date>
}

export interface FilterablePaymentProps extends BaseFilterable<FilterablePaymentProps> {
  id?: string | string[]
  paymentCollectionId?: string | string[]
  paymentSessionId?: string | string[]
  providerId?: string | string[]
  createdAt?: OperatorMap<Date>
}

export interface FilterableCaptureProps extends BaseFilterable<FilterableCaptureProps> {
  id?: string | string[]
  paymentId?: string | string[]
  createdAt?: OperatorMap<Date>
}

export interface FilterableRefundProps extends BaseFilterable<FilterableRefundProps> {
  id?: string | string[]
  paymentId?: string | string[]
  createdAt?: OperatorMap<Date>
}

export interface FilterableRefundReasonProps extends BaseFilterable<FilterableRefundReasonProps> {
  id?: string | string[]
  code?: string | string[]
}

export interface FilterablePaymentProviderProps extends BaseFilterable<FilterablePaymentProviderProps> {
  id?: string | string[]
  isEnabled?: boolean
}

export interface FilterablePaymentMethodProps {
  providerId: string
  context: Record<string, unknown>
}

export interface FilterableAccountHolderProps extends BaseFilterable<FilterableAccountHolderProps> {
  id?: string | string[]
  providerId?: string | string[]
  customerId?: string | string[]
}
