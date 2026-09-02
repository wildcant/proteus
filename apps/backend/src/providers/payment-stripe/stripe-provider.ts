import Stripe from 'stripe'
import { AppError, ErrorTypes } from '../../core/errors/app-error.js'
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
import { paymentActionOf, paymentSessionStatusOf } from './status-map.js'

type StripeOptions = {
  apiKey: string
  webhookSecret: string
}

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

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError
}

export class StripeProviderService extends AbstractPaymentProvider<StripeOptions> {
  static identifier = 'stripe'
  static label = 'Stripe'

  private stripe: Stripe

  constructor(container: Record<string, unknown>, config: StripeOptions) {
    super(container, config)
    this.stripe = new Stripe(config.apiKey)
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: toSmallestUnit(input.amount, input.currencyCode),
        currency: input.currencyCode,
        metadata: { sessionId: (input.data?.sessionId as string) ?? '' },
        // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
        capture_method: 'manual',
      },
      this.idempotencyKey(input.context),
    )

    return {
      id: intent.id,
      data: { id: intent.id, clientSecret: intent.client_secret },
      status: paymentSessionStatusOf(intent),
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const intent = await this.stripe.paymentIntents.retrieve(input.data?.id as string)
    return { status: paymentSessionStatusOf(intent), data: { id: intent.id } }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const id = input.data?.id as string
    try {
      await this.stripe.paymentIntents.capture(id, {}, this.idempotencyKey(input.context))
    } catch (error) {
      // Already succeeded (e.g. auto-capture or duplicate webhook) — treat as success
      if (isStripeError(error) && error.code === 'payment_intent_unexpected_state') {
        return { data: { id } }
      }
      throw error
    }
    return { data: { id } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const id = input.data?.id as string
    try {
      const intent = await this.stripe.paymentIntents.retrieve(id)
      if (intent.status === 'canceled') {
        return { data: { id } }
      }
      await this.stripe.paymentIntents.cancel(id, {}, this.idempotencyKey(input.context))
    } catch (error) {
      if (isStripeError(error) && error.code === 'payment_intent_unexpected_state') {
        return { data: { id } }
      }
      throw error
    }
    return { data: { id } }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const id = input.data?.id as string
    try {
      await this.stripe.refunds.create(
        // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
        { payment_intent: id, amount: toSmallestUnit(input.amount, input.currencyCode) },
        this.idempotencyKey(input.context),
      )
    } catch (error) {
      if (isStripeError(error) && error.code === 'charge_already_refunded') {
        return { data: { id } }
      }
      throw error
    }
    return { data: { id } }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const intent = await this.stripe.paymentIntents.retrieve(input.data?.id as string)
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

    await this.stripe.paymentIntents.update(input.data?.id as string, updateParams, this.idempotencyKey(input.context))
    return { data: { id: input.data?.id } }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const intent = await this.stripe.paymentIntents.retrieve(input.data?.id as string)
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

    // Back to the major unit here, at the adapter's edge: nothing above this line knows
    // Stripe counts in cents.
    const amount = fromSmallestUnit(intent.amount, intent.currency)

    return { action: paymentActionOf(intent), data: { sessionId, amount } }
  }

  // -- Optional: saved payment methods --

  async listPaymentMethods(input: ListPaymentMethodsInput): Promise<ListPaymentMethodsOutput> {
    const customerId = (input.context?.accountHolder as Record<string, unknown>)?.data as Record<string, unknown>
    const methods = await this.stripe.paymentMethods.list({
      customer: (customerId?.id as string) ?? '',
    })
    return methods.data.map((pm) => ({ id: pm.id, data: pm as unknown as Record<string, unknown> }))
  }

  async savePaymentMethod(input: SavePaymentMethodInput): Promise<SavePaymentMethodOutput> {
    const customerId = (input.context?.accountHolder as Record<string, unknown>)?.data as Record<string, unknown>
    const setupIntent = await this.stripe.setupIntents.create({
      customer: (customerId?.id as string) ?? '',
      ...(input.data as Stripe.SetupIntentCreateParams),
    })
    return { id: setupIntent.id, data: setupIntent as unknown as Record<string, unknown> }
  }

  async deletePaymentMethod(input: DeletePaymentMethodInput): Promise<DeletePaymentMethodOutput> {
    await this.stripe.paymentMethods.detach(input.data?.id as string)
    return {}
  }

  // -- Helpers --

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
