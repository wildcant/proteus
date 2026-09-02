import Stripe from 'stripe'
import { AppError, ErrorTypes } from '../../core/errors/app-error.js'
import type { Logger } from '../../core/types/logger.js'
import type { PaymentActions } from '../../core/types/payment/common.js'
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
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
} from '../../core/types/payment/mutations.js'
import { AbstractPaymentProvider } from '../../core/utils/abstract-payment-provider.js'
import { fromSmallestUnit, toSmallestUnit } from './currency-units.js'
import { classifyGatewayError, gatewayFailureLog, toAppError } from './errors.js'
import { type StripeOptions, validateStripeOptions } from './options.js'
import { paymentActionOf, paymentSessionStatusOf } from './status-map.js'

/**
 * The events whose `data.object` is a PaymentIntent. Which of them means what is not decided
 * here — the intent's own state is, through `paymentActionOf` — so this set only says "this
 * event is about an intent we can read", and nothing needs adding when a mapping changes.
 */
const PAYMENT_INTENT_EVENTS: ReadonlySet<string> = new Set([
  'payment_intent.succeeded',
  'payment_intent.amount_capturable_updated',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'payment_intent.requires_action',
  'payment_intent.processing',
])

const DEFAULT_RETRY_ATTEMPTS = 3
const DEFAULT_RETRY_BACKOFF_MS = 100

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError
}

/**
 * The amount a webhook reports, read from the field that means what the caller is asking.
 *
 * A completed charge is asked what it took, and an authorization what is left to take. Reading
 * the intent's nominal `amount` for both agrees with those today only because captures are
 * all-or-nothing — and stops agreeing, silently, the day the account is configured for
 * overcapture or multicapture.
 */
function webhookAmountOf(action: PaymentActions, intent: Stripe.PaymentIntent): number {
  if (action === 'captured') return intent.amount_received
  if (action === 'authorized') return intent.amount_capturable
  return intent.amount
}

export class StripeProviderService extends AbstractPaymentProvider<StripeOptions> {
  static identifier = 'stripe'
  static label = 'Stripe'

  static validateOptions(options: Record<string, unknown>): void {
    validateStripeOptions(StripeProviderService.identifier, options)
  }

  private stripe: Stripe
  private logger: Logger

  constructor(container: Record<string, unknown>, config: StripeOptions) {
    super(container, config)
    this.stripe = new Stripe(config.apiKey)
    this.logger = container.logger as Logger
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const intent = await this.gateway('initiatePayment', () =>
      this.stripe.paymentIntents.create(
        {
          amount: toSmallestUnit(input.amount, input.currencyCode),
          currency: input.currencyCode,
          metadata: { sessionId: (input.data?.sessionId as string) ?? '' },
          // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
          capture_method: 'manual',
        },
        this.idempotencyKey(input.context),
      ),
    )

    return {
      id: intent.id,
      data: { id: intent.id, clientSecret: intent.client_secret },
      status: paymentSessionStatusOf(intent),
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const intent = await this.gateway('authorizePayment', () =>
      this.stripe.paymentIntents.retrieve(input.data?.id as string),
    )
    return { status: paymentSessionStatusOf(intent), data: { id: intent.id } }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const id = input.data?.id as string
    // Already succeeded (e.g. auto-capture or duplicate webhook) — treat as success
    await this.gateway(
      'capturePayment',
      () => this.stripe.paymentIntents.capture(id, {}, this.idempotencyKey(input.context)),
      hasCode('payment_intent_unexpected_state'),
    )
    return { data: { id } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const id = input.data?.id as string
    const intent = await this.gateway('cancelPayment.retrieve', () => this.stripe.paymentIntents.retrieve(id))
    if (intent.status === 'canceled') {
      return { data: { id } }
    }
    // An intent that reached a terminal state between the read above and this write is already
    // where the cancel was trying to put it.
    await this.gateway(
      'cancelPayment',
      () => this.stripe.paymentIntents.cancel(id, {}, this.idempotencyKey(input.context)),
      hasCode('payment_intent_unexpected_state'),
    )
    return { data: { id } }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const id = input.data?.id as string
    await this.gateway(
      'refundPayment',
      () =>
        this.stripe.refunds.create(
          // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
          { payment_intent: id, amount: toSmallestUnit(input.amount, input.currencyCode) },
          this.idempotencyKey(input.context),
        ),
      hasCode('charge_already_refunded'),
    )
    return { data: { id } }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const intent = await this.gateway('retrievePayment', () =>
      this.stripe.paymentIntents.retrieve(input.data?.id as string),
    )
    return { data: intent as unknown as Record<string, unknown> }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    // The exponent that turns the amount into Stripe's unit is the currency's, so an amount
    // without one cannot be converted. Silently sending the major-unit decimal is how the
    // original bug charged twenty cents for a twenty-dollar order.
    if (input.amount !== undefined && input.currencyCode === undefined) {
      throw new AppError({
        type: ErrorTypes.INVALID_ARGUMENT,
        message: 'updatePayment was given an amount with no currency code.',
      })
    }

    const updateParams: Stripe.PaymentIntentUpdateParams = {}
    if (input.amount !== undefined && input.currencyCode !== undefined) {
      updateParams.amount = toSmallestUnit(input.amount, input.currencyCode)
    }
    if (input.currencyCode !== undefined) updateParams.currency = input.currencyCode

    const intent = await this.gateway('updatePayment', () =>
      this.stripe.paymentIntents.update(input.data?.id as string, updateParams, this.idempotencyKey(input.context)),
    )

    // The whole blob, not just the id: the storefront is mid-checkout holding the client secret
    // this carries, and a partial one would strand it with nothing to confirm against.
    return { data: { id: intent.id, clientSecret: intent.client_secret } }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const intent = await this.gateway('getPaymentStatus', () =>
      this.stripe.paymentIntents.retrieve(input.data?.id as string),
    )
    return { status: paymentSessionStatusOf(intent) }
  }

  async getWebhookActionAndData(payload: ProviderWebhookPayload['payload']): Promise<WebhookActionResult> {
    const signature = payload.headers['stripe-signature']
    if (!signature) throw new AppError({ type: ErrorTypes.INVALID_DATA, message: 'Missing stripe-signature header' })

    const event = this.verifyEvent(payload.rawData, signature)

    // Every event this adapter acts on carries a PaymentIntent, and `PAYMENT_INTENT_EVENTS`
    // is what guarantees the cast below. Anything else — a Stripe account shared with another
    // integration, an event type enabled in the dashboard — is not ours to interpret.
    if (!PAYMENT_INTENT_EVENTS.has(event.type)) return { action: 'not_supported' }

    const intent = event.data.object as Stripe.PaymentIntent
    const sessionId = intent.metadata?.sessionId

    // Ignore events from other integrations sharing this Stripe account
    if (!sessionId) {
      return { action: 'not_supported' }
    }

    const action = paymentActionOf(intent)

    // Back to the major unit here, at the adapter's edge: nothing above this line knows
    // Stripe counts in cents.
    const amount = fromSmallestUnit(webhookAmountOf(action, intent), intent.currency)

    return { action, data: { sessionId, amount } }
  }

  // -- Optional: saved payment methods --

  async listPaymentMethods(input: ListPaymentMethodsInput): Promise<ListPaymentMethodsOutput> {
    const customerId = (input.context?.accountHolder as Record<string, unknown>)?.data as Record<string, unknown>
    const methods = await this.gateway('listPaymentMethods', () =>
      this.stripe.paymentMethods.list({
        customer: (customerId?.id as string) ?? '',
      }),
    )
    return methods.data.map((pm) => ({ id: pm.id, data: pm as unknown as Record<string, unknown> }))
  }

  async savePaymentMethod(input: SavePaymentMethodInput): Promise<SavePaymentMethodOutput> {
    const customerId = (input.context?.accountHolder as Record<string, unknown>)?.data as Record<string, unknown>
    const setupIntent = await this.gateway('savePaymentMethod', () =>
      this.stripe.setupIntents.create({
        customer: (customerId?.id as string) ?? '',
        ...(input.data as Stripe.SetupIntentCreateParams),
      }),
    )
    return { id: setupIntent.id, data: setupIntent as unknown as Record<string, unknown> }
  }

  async deletePaymentMethod(input: DeletePaymentMethodInput): Promise<DeletePaymentMethodOutput> {
    await this.gateway('deletePaymentMethod', () => this.stripe.paymentMethods.detach(input.data?.id as string))
    return {}
  }

  // -- Helpers --

  /**
   * Every call to the vendor SDK goes through here, which is what makes the three guarantees
   * below true of all of them rather than of the ones somebody remembered.
   *
   * 1. A connection or throttling failure is retried, and the caller's idempotency key is
   *    unchanged across attempts — which is the only reason retrying a write is safe at all.
   * 2. The failure is logged whole: type, code, decline code and the dashboard link.
   * 3. What escapes is our own error carrying a code, never Stripe's — whose messages include
   *    `"Invalid API Key provided: sk_test_*****dkey"` and `"No such PaymentMethod: 'pm_…'"`.
   */
  private async gateway<T>(operation: string, call: () => Promise<T>): Promise<T>
  private async gateway<T>(
    operation: string,
    call: () => Promise<T>,
    /** A failure this call asked for anyway: the gateway is already in the state it wanted.
     *  Answering `true` returns `undefined` instead of throwing, and logs nothing — a gateway
     *  redelivering its own completed event would otherwise fill the log with non-failures. */
    isSettled: (error: Stripe.errors.StripeError) => boolean,
  ): Promise<T | undefined>
  private async gateway<T>(
    operation: string,
    call: () => Promise<T>,
    isSettled?: (error: Stripe.errors.StripeError) => boolean,
  ): Promise<T | undefined> {
    const attempts = this.config.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS
    const backoffMs = this.config.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS

    for (let attempt = 1; ; attempt++) {
      try {
        return await call()
      } catch (error) {
        if (isStripeError(error) && isSettled?.(error)) {
          this.logger.debug(`[stripe] ${operation}: already settled at the gateway (${error.code})`)
          return undefined
        }

        this.logger.error(gatewayFailureLog(operation, error))

        if (classifyGatewayError(error) !== 'retry' || attempt >= attempts) {
          throw toAppError(error)
        }

        // Jittered so a gateway blip does not turn every waiting request into one synchronised
        // retry storm the moment it clears.
        const wait = backoffMs * 2 ** (attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, wait * (0.5 + Math.random() / 2)))
      }
    }
  }

  private idempotencyKey(context?: Record<string, unknown>): Stripe.RequestOptions | undefined {
    const key = context?.idempotencyKey as string | undefined
    return key ? { idempotencyKey: key } : undefined
  }

  /**
   * Stripe signs the exact bytes it sent, so `rawData` must be those bytes and not a
   * re-serialisation of the parsed body — key order, spacing and unicode escaping all differ
   * after a round trip through `JSON.parse`.
   *
   * A payload that does not verify is the caller's problem, not ours: it comes back as a client
   * error so Stripe stops redelivering something that can never verify.
   */
  private verifyEvent(rawData: string | Uint8Array, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(rawData, signature, this.config.webhookSecret)
    } catch (error) {
      if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
        throw new AppError({ type: ErrorTypes.INVALID_DATA, message: 'Webhook signature verification failed' })
      }
      throw error
    }
  }
}

/** Reads the gateway's own error code, which only `gateway()` still sees — what it rethrows is
 *  our error, carrying our code and none of Stripe's wording. */
const hasCode = (code: string) => (error: Stripe.errors.StripeError) => error.code === code
