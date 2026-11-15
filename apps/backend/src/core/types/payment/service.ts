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
  PaymentSessionAuthorization,
  PaymentSessionDTO,
  RefundReasonDTO,
  SavedMethodDTO,
} from './common.js'
import type {
  CancelPaymentCollectionDTO,
  CapturePaymentCollectionDTO,
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
  /**
   * Authorizes a session at its provider and records what came back.
   *
   * Answers with a discriminated outcome rather than a nullable payment: a caller has to be able
   * to tell an intent that is still settling from one the provider refused, and `null` said both.
   * Idempotent — a session already authorized answers with the payment it produced.
   */
  authorizePaymentSession(id: string, context?: Context): Promise<PaymentSessionAuthorization>

  // Payment retrieval
  retrievePayment(id: string, context?: Context): Promise<PaymentDTO>

  // Payment lifecycle
  capturePayment(data: CreateCaptureDTO, context?: Context): Promise<PaymentDTO>
  refundPayment(data: CreateRefundDTO, context?: Context): Promise<PaymentDTO>
  cancelPayment(paymentId: string, context?: Context): Promise<PaymentDTO>
  /**
   * Voids every authorization on the collection still holding money and marks it canceled, under
   * its row lock: what an Order's cancel does before it refunds anything. No capture lands on a
   * canceled collection. Refused, with nothing voided, when the collection's captures no longer
   * add up to `capturedAmount`.
   */
  cancelPaymentCollection(
    paymentCollectionId: string,
    data: CancelPaymentCollectionDTO,
    context?: Context,
  ): Promise<PaymentCollectionDTO>
  /** Takes the cancel mark off, for an Order cancel that rolled back. What was voided stays voided. */
  reopenPaymentCollection(paymentCollectionId: string, context?: Context): Promise<PaymentCollectionDTO>
  /**
   * Records a payment of an amount against a collection, under its row lock: opens and authorizes
   * a manual session for what is outstanding when the collection holds no live authorization, then
   * captures the amount. Refused above what is outstanding, net of refunds. A capture already recorded under
   * `idempotencyKey` is answered with rather than taken again.
   */
  capturePaymentCollection(
    paymentCollectionId: string,
    data: CapturePaymentCollectionDTO,
    context?: Context,
  ): Promise<PaymentDTO>

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
