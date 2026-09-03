import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  AccountHolderDTO,
  FilterableAccountHolderProps,
  FilterablePaymentProviderProps,
  PaymentCollectionDTO,
  PaymentDTO,
  PaymentProviderDTO,
  PaymentProviderMeta,
  PaymentSessionDTO,
  RefundReasonDTO,
  SavedMethodDTO,
} from './common.js'
import type {
  CreateAccountHolderDTO,
  CreateCaptureDTO,
  CreatePaymentCollectionDTO,
  CreatePaymentSessionDTO,
  CreateRefundDTO,
  CreateRefundReasonDTO,
  EnsureAccountHoldersDTO,
  ProviderWebhookPayload,
  UpdatePaymentCollectionDTO,
  UpdatePaymentSessionDTO,
  UpdateRefundReasonDTO,
  WebhookActionResult,
} from './mutations.js'

export type IPaymentModuleService = {
  // PaymentCollection CRUD
  createPaymentCollections(data: CreatePaymentCollectionDTO[], context?: Context): Promise<PaymentCollectionDTO[]>
  retrievePaymentCollection(
    id: string,
    config?: FindConfig<PaymentCollectionDTO>,
    context?: Context,
  ): Promise<PaymentCollectionDTO>
  updatePaymentCollections(
    ids: string[],
    data: UpdatePaymentCollectionDTO,
    context?: Context,
  ): Promise<PaymentCollectionDTO[]>
  createPaymentCollection(data: CreatePaymentCollectionDTO, context?: Context): Promise<PaymentCollectionDTO>
  updatePaymentCollection(
    id: string,
    data: UpdatePaymentCollectionDTO,
    context?: Context,
  ): Promise<PaymentCollectionDTO>
  softDeletePaymentCollections(ids: string[], context?: Context): Promise<void>
  restorePaymentCollections(ids: string[], context?: Context): Promise<void>

  // PaymentSession lifecycle
  createPaymentSession(
    paymentCollectionId: string,
    input: CreatePaymentSessionDTO,
    context?: Context,
  ): Promise<PaymentSessionDTO>
  /**
   * Opens a session, abandoning every attempt on the collection that has not become money and
   * cancelling it at the gateway.
   *
   * The operation a checkout wants, where each Place order press is the same shopper trying
   * again. `createPaymentSession` is the one a split payment wants, where each session is a
   * different part of one total.
   */
  replacePaymentSession(
    paymentCollectionId: string,
    input: CreatePaymentSessionDTO,
    context?: Context,
  ): Promise<PaymentSessionDTO>
  /** Re-prices an open session. `data.amount` must be a server-computed total, never one a
   *  browser supplied. An unchanged amount does not reach the provider. */
  updatePaymentSession(id: string, data: UpdatePaymentSessionDTO, context?: Context): Promise<PaymentSessionDTO>
  /** Destructive: the session is destroyed at the provider, so there is nothing to restore. */
  deletePaymentSession(id: string, context?: Context): Promise<void>
  authorizePaymentSession(id: string, context?: Context): Promise<PaymentDTO | null>

  // Payment retrieval
  retrievePayment(id: string, context?: Context): Promise<PaymentDTO>

  // Payment lifecycle
  capturePayment(data: CreateCaptureDTO, context?: Context): Promise<PaymentDTO>
  refundPayment(data: CreateRefundDTO, context?: Context): Promise<PaymentDTO>
  cancelPayment(paymentId: string, context?: Context): Promise<PaymentDTO>

  // Providers
  listPaymentProviders(
    filters?: FilterablePaymentProviderProps,
    config?: FindConfig<PaymentProviderDTO>,
    context?: Context,
  ): Promise<PaymentProviderDTO[]>
  getProviderMeta(providerId: string): PaymentProviderMeta

  // Webhooks
  getWebhookActionAndData(data: ProviderWebhookPayload): Promise<WebhookActionResult>

  // AccountHolder
  createAccountHolder(input: CreateAccountHolderDTO, context?: Context): Promise<AccountHolderDTO>
  /**
   * The customer's account holder at every provider that has the concept, created on first need.
   *
   * The caller decides whether the customer is an *account*: Proteus gives every guest a Customer
   * row, and a guest must leave nothing behind at a gateway.
   */
  ensureAccountHolders(input: EnsureAccountHoldersDTO, context?: Context): Promise<AccountHolderDTO[]>
  listAccountHolders(
    filters?: FilterableAccountHolderProps,
    config?: FindConfig<AccountHolderDTO>,
    context?: Context,
  ): Promise<AccountHolderDTO[]>
  deleteAccountHolder(id: string, context?: Context): Promise<void>

  // The wallet (provider-managed, no DB table). Ownership is verified at the gateway, per write.
  listSavedMethods(customerId: string, context?: Context): Promise<SavedMethodDTO[]>
  deleteSavedMethod(customerId: string, methodId: string, context?: Context): Promise<void>
  setDefaultSavedMethod(customerId: string, methodId: string, context?: Context): Promise<void>

  // RefundReasons
  createRefundReasons(data: CreateRefundReasonDTO[], context?: Context): Promise<RefundReasonDTO[]>
  listRefundReasons(context?: Context): Promise<RefundReasonDTO[]>
  updateRefundReasons(ids: string[], data: UpdateRefundReasonDTO, context?: Context): Promise<RefundReasonDTO[]>
  createRefundReason(data: CreateRefundReasonDTO, context?: Context): Promise<RefundReasonDTO>
  updateRefundReason(id: string, data: UpdateRefundReasonDTO, context?: Context): Promise<RefundReasonDTO>
  softDeleteRefundReasons(ids: string[], context?: Context): Promise<void>
  restoreRefundReasons(ids: string[], context?: Context): Promise<void>
}
