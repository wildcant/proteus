import type { BigNumber } from '../../db/bignum.js'
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
