import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  AccountHolderDTO,
  FilterablePaymentMethodProps,
  FilterablePaymentProviderProps,
  PaymentCollectionDTO,
  PaymentDTO,
  PaymentMethodDTO,
  PaymentProviderDTO,
  PaymentSessionDTO,
  RefundReasonDTO,
} from './common.js'
import type {
  CreateAccountHolderDTO,
  CreateCaptureDTO,
  CreatePaymentCollectionDTO,
  CreatePaymentMethodDTO,
  CreatePaymentSessionDTO,
  CreateRefundDTO,
  CreateRefundReasonDTO,
  DeletePaymentMethodDTO,
  ProviderWebhookPayload,
  UpdatePaymentCollectionDTO,
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
  deletePaymentCollections(ids: string[], context?: Context): Promise<void>
  softDeletePaymentCollections(ids: string[], context?: Context): Promise<void>
  restorePaymentCollections(ids: string[], context?: Context): Promise<void>

  // PaymentSession lifecycle
  createPaymentSession(
    paymentCollectionId: string,
    input: CreatePaymentSessionDTO,
    context?: Context,
  ): Promise<PaymentSessionDTO>
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
  getProviderMeta(providerId: string): { label: string; isTestOnly: boolean }

  // Webhooks
  getWebhookActionAndData(data: ProviderWebhookPayload): Promise<WebhookActionResult>

  // AccountHolder
  createAccountHolder(input: CreateAccountHolderDTO, context?: Context): Promise<AccountHolderDTO>
  deleteAccountHolder(id: string, context?: Context): Promise<void>

  // PaymentMethods (provider-managed, no DB table)
  listPaymentMethods(
    filters: FilterablePaymentMethodProps,
    config?: FindConfig<PaymentMethodDTO>,
    context?: Context,
  ): Promise<PaymentMethodDTO[]>
  createPaymentMethods(data: CreatePaymentMethodDTO[], context?: Context): Promise<PaymentMethodDTO[]>
  deletePaymentMethods(data: DeletePaymentMethodDTO[], context?: Context): Promise<void>

  // RefundReasons
  createRefundReasons(data: CreateRefundReasonDTO[], context?: Context): Promise<RefundReasonDTO[]>
  listRefundReasons(context?: Context): Promise<RefundReasonDTO[]>
  updateRefundReasons(ids: string[], data: UpdateRefundReasonDTO, context?: Context): Promise<RefundReasonDTO[]>
  createRefundReason(data: CreateRefundReasonDTO, context?: Context): Promise<RefundReasonDTO>
  updateRefundReason(id: string, data: UpdateRefundReasonDTO, context?: Context): Promise<RefundReasonDTO>
  deleteRefundReasons(ids: string[], context?: Context): Promise<void>
  softDeleteRefundReasons(ids: string[], context?: Context): Promise<void>
  restoreRefundReasons(ids: string[], context?: Context): Promise<void>
}
