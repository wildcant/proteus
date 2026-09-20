import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  CreateAccountHolderInput,
  CreateAccountHolderOutput,
  DeleteAccountHolderInput,
  DeleteAccountHolderOutput,
  DeletePaymentInput,
  DeletePaymentMethodInput,
  DeletePaymentMethodOutput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ListPaymentMethodsInput,
  ListPaymentMethodsOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  SavePaymentMethodInput,
  SavePaymentMethodOutput,
  SetDefaultPaymentMethodInput,
  SetDefaultPaymentMethodOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from './mutations.js'

export interface IPaymentProvider {
  getIdentifier(): string

  /**
   * The subset of this provider's configuration that is safe to hand a browser, so the client
   * adapter can boot without a storefront environment variable of its own.
   *
   * Implementations name every key they return. Spreading the options object here puts the API
   * key and the webhook secret in a storefront — see `getPublicConfig` on the Stripe adapter.
   * Optional: a provider with nothing publishable does not implement it, and is served `{}`.
   */
  getPublicConfig?(): Record<string, unknown>

  // Core payment lifecycle
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput>
  authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput>
  capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput>
  cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput>
  deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput>
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput>
  retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput>
  updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput>
  getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput>

  // Webhooks
  getWebhookActionAndData(data: ProviderWebhookPayload['payload']): Promise<WebhookActionResult>

  // Account holders (optional)
  createAccountHolder?(input: CreateAccountHolderInput): Promise<CreateAccountHolderOutput>
  deleteAccountHolder?(input: DeleteAccountHolderInput): Promise<DeleteAccountHolderOutput>

  // Saved payment methods (optional)
  listPaymentMethods?(input: ListPaymentMethodsInput): Promise<ListPaymentMethodsOutput>
  savePaymentMethod?(input: SavePaymentMethodInput): Promise<SavePaymentMethodOutput>
  deletePaymentMethod?(input: DeletePaymentMethodInput): Promise<DeletePaymentMethodOutput>
  /**
   * Nominates the method the gateway should treat as this account holder's default.
   *
   * Optional for the same reason its neighbours are: "the default card" is a concept some
   * gateways hold and others do not, and a provider without one should not have to carry a stub
   * that throws. The module answers `undefined` rather than calling a method that is not there.
   */
  setDefaultPaymentMethod?(input: SetDefaultPaymentMethodInput): Promise<SetDefaultPaymentMethodOutput>
}
