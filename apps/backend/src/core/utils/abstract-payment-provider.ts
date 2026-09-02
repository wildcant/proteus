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
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from '../types/payment/mutations.js'
import type { IPaymentProvider } from '../types/payment/provider.js'

/**
 * Abstract base class that all payment providers must extend.
 *
 * Subclasses must set a static `identifier` string and implement all abstract methods
 * for the payment lifecycle. The provider's ID is stored as `pp_{identifier}_{id}`,
 * where `{id}` comes from the provider configuration in `container.ts`.
 *
 * The constructor receives the module's DI container and provider-specific options.
 * Use the constructor to initialise SDK clients or establish connections with
 * third-party services.
 *
 * @typeParam TConfig - Shape of the provider's options (e.g. `{ apiKey: string }`).
 *
 * @example
 * ```ts
 * type StripeOptions = { apiKey: string; webhookSecret: string }
 *
 * class StripeProviderService extends AbstractPaymentProvider<StripeOptions> {
 *   static identifier = 'stripe'
 *   private stripe: Stripe
 *
 *   constructor(container: Record<string, unknown>, config: StripeOptions) {
 *     super(container, config)
 *     this.stripe = new Stripe(config.apiKey)
 *   }
 *   // …implement abstract methods
 * }
 * ```
 */
export abstract class AbstractPaymentProvider<TConfig = Record<string, unknown>> implements IPaymentProvider {
  /**
   * Unique identifier for this provider type. Subclasses **must** override this.
   * The value is used to build the provider's registration key (`pp_{identifier}_{id}`).
   */
  static identifier: string

  /** Human-readable name shown to customers in the storefront. */
  static label = 'Unknown'

  /** Whether this provider is for testing/development only. */
  static isTestOnly = false

  /**
   * Checked by the provider loader before the provider is constructed, so a deployment missing a
   * credential fails at boot rather than at the first payment — which is in front of a shopper,
   * as an unexplained failure, however long after the deploy that caused it. Throw to refuse
   * startup, naming the provider and the option. Optional: a provider with nothing to check does
   * not implement it.
   */
  static validateOptions?(options: Record<string, unknown>): void

  protected config: TConfig
  protected container: Record<string, unknown>

  constructor(container: Record<string, unknown>, config: TConfig) {
    this.container = container
    this.config = config
  }

  /**
   * Returns the static `identifier` defined on the concrete subclass.
   * @throws {Error} If `identifier` is not set on the subclass.
   */
  getIdentifier(): string {
    const ctr = this.constructor as typeof AbstractPaymentProvider

    if (!ctr.identifier) {
      throw new Error('Missing static property "identifier".')
    }

    return ctr.identifier
  }

  /**
   * Initialise a payment session with the third-party provider.
   *
   * Called when a customer selects a payment method during checkout.
   * The returned `data` is stored on the `PaymentSession` record and is
   * publicly accessible to storefronts (do not store secrets here).
   *
   * @returns An object with a provider-side `id` and optional `data`/`status`.
   */
  abstract initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput>

  /**
   * Authorise a previously initiated payment session.
   *
   * Called during cart completion. If authorization is asynchronous (e.g. bank
   * transfers, vouchers), return `status: 'pending_authorization'` — no
   * `Payment` record will be created until a later webhook or retry confirms it.
   *
   * The input `data` comes from the `PaymentSession.data` set by {@link initiatePayment}.
   * The returned `data` is stored on the created `Payment` record.
   *
   * @returns The authorization status and optional provider data.
   */
  abstract authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput>

  /**
   * Capture a previously authorised payment.
   *
   * Triggered by an admin action or a webhook event returning `action: 'captured'`.
   * The input `data` comes from the `Payment.data` set by {@link authorizePayment}.
   * The returned `data` replaces the existing `Payment.data`.
   */
  abstract capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput>

  /**
   * Cancel an authorised (but not yet captured) payment.
   *
   * Triggered when an admin cancels an order whose payment hasn't been captured.
   * The input `data` comes from `Payment.data`.
   */
  abstract cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput>

  /**
   * Delete a payment session in the third-party provider.
   *
   * Called when a customer switches payment methods during checkout, removing
   * the previous session. If the provider doesn't support deletion, return
   * the received `data` unchanged.
   *
   * The input `data` comes from `PaymentSession.data` set by {@link initiatePayment}.
   */
  abstract deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput>

  /**
   * Refund a previously captured payment (fully or partially).
   *
   * May be called multiple times for partial refunds. The input `data` comes
   * from `Payment.data` (as last set by {@link capturePayment} or a prior refund).
   * The returned `data` replaces the existing `Payment.data`.
   */
  abstract refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput>

  /**
   * Retrieve the payment's current data from the third-party provider.
   */
  abstract retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput>

  /**
   * Update a previously initiated payment (e.g. amount or currency changed).
   *
   * The input `data` comes from `PaymentSession.data`.
   */
  abstract updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput>

  /**
   * Query the third-party provider for the current payment status.
   *
   * Map the provider's native status to a `PaymentSessionStatus` value.
   */
  abstract getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput>

  /**
   * Process an incoming webhook event from the third-party provider.
   *
   * Verify the event signature, determine the action (`authorized`, `captured`,
   * `failed`, etc.), and extract the `sessionId` + `amount` from the payload.
   *
   * @returns A {@link WebhookActionResult} describing the action to take.
   */
  abstract getWebhookActionAndData(data: ProviderWebhookPayload['payload']): Promise<WebhookActionResult>

  // Optional methods — providers override if supported
  createAccountHolder?(input: CreateAccountHolderInput): Promise<CreateAccountHolderOutput>
  deleteAccountHolder?(input: DeleteAccountHolderInput): Promise<DeleteAccountHolderOutput>
  listPaymentMethods?(input: ListPaymentMethodsInput): Promise<ListPaymentMethodsOutput>
  savePaymentMethod?(input: SavePaymentMethodInput): Promise<SavePaymentMethodOutput>
  deletePaymentMethod?(input: DeletePaymentMethodInput): Promise<DeletePaymentMethodOutput>
}
