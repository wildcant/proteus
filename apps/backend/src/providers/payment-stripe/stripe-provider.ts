import Stripe from 'stripe'
import { BigNumber } from '../../core/db/bignum.js'
import type { PaymentSessionStatus } from '../../core/types/payment/common.js'
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

type StripeOptions = {
  apiKey: string
  webhookSecret: string
}

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError
}

export class StripeProviderService extends AbstractPaymentProvider<StripeOptions> {
  static identifier = 'stripe'

  private stripe: Stripe

  constructor(container: Record<string, unknown>, config: StripeOptions) {
    super(container, config)
    this.stripe = new Stripe(config.apiKey)
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: input.amount.toNumber(),
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
      status: this.mapStripeStatus(intent),
    }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const intent = await this.stripe.paymentIntents.retrieve(input.data?.id as string)
    return { status: this.mapStripeStatus(intent), data: { id: intent.id } }
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
        { payment_intent: id, amount: input.amount.toNumber() },
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
    const updateParams: Stripe.PaymentIntentUpdateParams = {}
    if (input.amount !== undefined) updateParams.amount = input.amount.toNumber()
    if (input.currencyCode !== undefined) updateParams.currency = input.currencyCode

    await this.stripe.paymentIntents.update(input.data?.id as string, updateParams, this.idempotencyKey(input.context))
    return { data: { id: input.data?.id } }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const intent = await this.stripe.paymentIntents.retrieve(input.data?.id as string)
    return { status: this.mapStripeStatus(intent) }
  }

  async getWebhookActionAndData(payload: ProviderWebhookPayload['payload']): Promise<WebhookActionResult> {
    const signature = payload.headers['stripe-signature']
    if (!signature) throw new Error('Missing stripe-signature header')

    const event = this.stripe.webhooks.constructEvent(payload.rawData as string, signature, this.config.webhookSecret)

    const intent = event.data.object as Stripe.PaymentIntent
    const sessionId = intent.metadata?.sessionId
    const amount = new BigNumber(intent.amount)

    // Ignore events from other integrations sharing this Stripe account
    if (!sessionId) {
      return { action: 'not_supported' }
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        return { action: 'captured', data: { sessionId, amount } }
      case 'payment_intent.amount_capturable_updated':
        return { action: 'authorized', data: { sessionId, amount } }
      case 'payment_intent.payment_failed':
        return { action: 'failed', data: { sessionId, amount } }
      case 'payment_intent.canceled':
        return { action: 'canceled', data: { sessionId, amount } }
      case 'payment_intent.requires_action':
        return { action: 'requires_more', data: { sessionId, amount } }
      case 'payment_intent.processing':
        return { action: 'pending', data: { sessionId, amount } }
      default:
        return { action: 'not_supported' }
    }
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

  private mapStripeStatus(intent: Stripe.PaymentIntent): PaymentSessionStatus {
    switch (intent.status) {
      case 'requires_payment_method':
        return intent.last_payment_error ? 'error' : 'pending'
      case 'requires_action':
      case 'requires_confirmation':
        return 'requires_more'
      case 'processing':
        return 'pending_authorization'
      case 'requires_capture':
        return 'authorized'
      case 'succeeded':
        return 'captured'
      case 'canceled':
        return 'canceled'
      default:
        return 'pending'
    }
  }
}
