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
} from '../../core/types/payment/mutations.js'
import { AbstractPaymentProvider } from '../../core/utils/abstract-payment-provider.js'
import { fromSmallestUnit, toSmallestUnit } from './currency-units.js'
import { classifyGatewayError, gatewayFailureLog, toAppError } from './errors.js'
import { type StripeOptions, validateStripeOptions } from './options.js'
import { defaultMethodIdOf, toSavedMethods } from './saved-methods.js'
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

/**
 * How many stored cards one wallet read asks for. Explicit, because Stripe's own default is ten
 * and a shopper with an eleventh would silently not be shown it.
 */
const SAVED_METHOD_LIMIT = 50

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError
}

/** The intent parameters a shopper's wallet contributes, and nothing else the intent needs. */
type WalletIntentParams = Pick<Stripe.PaymentIntentCreateParams, 'setup_future_usage' | 'payment_method'>

/** Omits the key entirely when there is no value, rather than sending `undefined` as a field. */
function optional(name: string, value: unknown): Record<string, string> {
  return typeof value === 'string' && value !== '' ? { [name]: value } : {}
}

/**
 * The gateway's id for an account holder, or a refusal.
 *
 * `@medusajs/payment-stripe` falls back to `''` here, and an empty customer id is not an error at
 * Stripe — it is a request scoped to nobody, which for a listing means the whole account. A
 * wallet operation with no account holder is a bug in the caller and says so.
 */
function accountHolderIdOf(context: Record<string, unknown> | undefined): string {
  const holder = context?.accountHolder as { externalId?: unknown } | undefined
  const id = holder?.externalId

  if (typeof id !== 'string' || id === '') {
    throw new AppError({
      type: ErrorTypes.INVALID_ARGUMENT,
      message: 'A saved-method operation reached the Stripe adapter with no account holder.',
    })
  }

  return id
}

function methodIdOf(data: Record<string, unknown> | undefined): string {
  const id = data?.id

  if (typeof id !== 'string' || id === '') {
    throw new AppError({
      type: ErrorTypes.INVALID_ARGUMENT,
      message: 'A saved-method operation reached the Stripe adapter with no payment method id.',
    })
  }

  return id
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
    /**
     * The fetch client, explicitly, rather than letting the SDK pick one per runtime.
     *
     * Two reasons, the second load-bearing. `fetch` is the HTTP client Node and workerd both
     * have, so a gateway call takes the same code path in the server and in the Workers
     * deployment. And it is the client the e2e server can stand a fake gateway in front of: the
     * SDK's Node client, intercepted, leaves the request hanging — which would leave the whole
     * submit sequence unverifiable end to end.
     *
     * Wrapped rather than passed bare because the SDK binds whatever function it is handed, and
     * this provider is constructed while the container is built — before anything a runtime
     * installs afterwards. Resolving `fetch` per call is what lets a replacement be seen at all.
     */
    this.stripe = new Stripe(config.apiKey, {
      httpClient: Stripe.createFetchHttpClient((input, init) => fetch(input, init)),
    })
    this.logger = container.logger as Logger
  }

  /**
   * The one option a browser is allowed to see, written out rather than spread.
   *
   * `StripeOptions` also holds `apiKey` and `webhookSecret`. `{ ...this.config }` would put both
   * on a public endpoint, and would keep doing so silently as options are added — which is why
   * this names its key and `payment-provider.api.test.ts` asserts the response has no other.
   */
  getPublicConfig(): { publishableKey: string } {
    return { publishableKey: this.config.publishableKey }
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const context = input.context ?? {}
    const customerId = (context.accountHolder as { externalId?: unknown } | undefined)?.externalId
    const walletParams = await this.walletParamsFor(context)

    const intent = await this.gateway('initiatePayment', () =>
      this.stripe.paymentIntents.create(
        {
          amount: toSmallestUnit(input.amount, input.currencyCode),
          currency: input.currencyCode,
          metadata: { sessionId: (input.data?.sessionId as string) ?? '' },
          // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
          capture_method: 'manual',
          ...optional('customer', customerId),
          ...walletParams,
        },
        this.idempotencyKey(context),
      ),
    )

    return {
      id: intent.id,
      data: { id: intent.id, clientSecret: intent.client_secret },
      status: paymentSessionStatusOf(intent),
    }
  }

  /**
   * What the shopper's wallet adds to the intent: the card they chose, and whether to keep it.
   *
   * Both are gated on there being an account holder, because both are meaningless without one —
   * a guest has no wallet to charge from and nothing to save into. And the chosen card's
   * ownership is checked *before* the intent exists rather than after: an intent naming another
   * customer's payment method should never be created at all.
   */
  private async walletParamsFor(context: Record<string, unknown>): Promise<WalletIntentParams> {
    // Consent is a property of the session, never of how many cards are already stored: the
    // shopper with an empty wallet is precisely the one saving their first.
    const consented = context.savePaymentMethod === true && context.accountHolder !== undefined
    // `on_session`, not `off_session`: the shopper is present for every charge this wallet is
    // for. Off-session charging is a different feature with a stronger authentication cost.
    // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
    const save: WalletIntentParams = consented ? { setup_future_usage: 'on_session' } : {}

    const chosenMethodId = context.paymentMethodId
    if (typeof chosenMethodId !== 'string' || chosenMethodId === '') return save

    const customerId = accountHolderIdOf(context)
    await this.assertOwned(customerId, chosenMethodId)

    // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
    return { ...save, payment_method: chosenMethodId }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const intent = await this.gateway('authorizePayment', () =>
      this.stripe.paymentIntents.retrieve(input.data?.id as string),
    )

    await this.markRedisplayable(intent)

    return { status: paymentSessionStatusOf(intent), data: { id: intent.id } }
  }

  /**
   * Makes a card the shopper agreed to save actually reappear in their wallet.
   *
   * `setup_future_usage` attaches the method to the Customer, and that is all it does: on the
   * current API version the attached method's `allow_redisplay` stays `unspecified`, and the
   * customer-scoped listing filters that out. Medusa's provider sets neither, which is why a card
   * can be attached to a customer and invisible to every selector — saved, in the sense that
   * nobody can ever see it. Setting it is its own call, and this is the first moment after the
   * browser's confirmation that the server sees the method at all.
   *
   * Best-effort on purpose. The shopper has paid by the time this runs; a card that does not
   * redisplay is worth a log line, not a failed order.
   */
  private async markRedisplayable(intent: Stripe.PaymentIntent): Promise<void> {
    if (!intent.setup_future_usage || !intent.customer) return

    const methodId = typeof intent.payment_method === 'string' ? intent.payment_method : intent.payment_method?.id
    if (!methodId) return

    await this.gateway('setAllowRedisplay', () =>
      this.stripe.paymentMethods.update(methodId, {
        // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
        allow_redisplay: 'always',
      }),
    ).catch((error) => this.logger.error(error))
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const id = input.data?.id as string
    // A capture the gateway has already performed — auto-capture, or a redelivered webhook — is
    // the one refusal that is not a failure. Only that one: see `settledAt`.
    await this.gateway(
      'capturePayment',
      () => this.stripe.paymentIntents.capture(id, {}, this.idempotencyKey(input.context)),
      this.settledAt(id, 'succeeded'),
    )
    return { data: { id } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const id = input.data?.id as string
    // No pre-flight read. It cost a round trip and bought a time-of-check race: an intent can be
    // captured between the read and the cancel, and the cancel would then be refused for a reason
    // the read said could not happen. Cancelling an already-cancelled intent is refused with
    // `payment_intent_unexpected_state`, which is the case `settledAt` recognises.
    await this.gateway(
      'cancelPayment',
      () => this.stripe.paymentIntents.cancel(id, {}, this.idempotencyKey(input.context)),
      this.settledAt(id, 'canceled'),
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
      alreadyRefunded,
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

    const event = await this.verifyEvent(payload.rawData, signature)

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

  // -- Optional: account holders --

  /**
   * The Stripe Customer a saved card hangs off.
   *
   * Created only when the module asks, which it only does for a shopper with an account — a
   * guest leaves nothing here. The idempotency key is the module's, derived from the Proteus
   * customer id, so two checkouts opening at the same moment cannot leave two Customers behind.
   */
  async createAccountHolder(input: CreateAccountHolderInput): Promise<CreateAccountHolderOutput> {
    const context = input.context ?? {}
    const customer = await this.gateway('createAccountHolder', () =>
      this.stripe.customers.create(
        {
          ...optional('email', context.email),
          ...optional('name', context.name),
          // The link back, for anyone reading this Customer in the Stripe dashboard. Nothing
          // reads it programmatically: `account_holder` is where the mapping is authoritative.
          metadata: { customerId: String(context.customerId ?? '') },
        },
        this.idempotencyKey(context),
      ),
    )

    return { id: customer.id, data: { id: customer.id } }
  }

  async deleteAccountHolder(input: DeleteAccountHolderInput): Promise<DeleteAccountHolderOutput> {
    const id = input.data?.id
    if (typeof id !== 'string' || id === '') {
      throw new AppError({
        type: ErrorTypes.INVALID_ARGUMENT,
        message: 'deleteAccountHolder was given no gateway customer id.',
      })
    }

    await this.gateway('deleteAccountHolder', () => this.stripe.customers.del(id))
    return {}
  }

  // -- Optional: saved payment methods --

  /**
   * The customer's redisplayable cards, through the customer-scoped listing.
   *
   * Two deliberate differences from `@medusajs/payment-stripe`, both of which are the difference
   * between a wallet that works and one that quietly does not:
   *
   * - The **customer-scoped** endpoint, not `paymentMethods.list({ customer })`. The generic one
   *   takes a customer id that can be an empty string, and an empty string is not an error — it
   *   is a request for every payment method on the account.
   * - An explicit `allow_redisplay: 'always'` filter. Stripe attaches methods a shopper never
   *   agreed to redisplay, and listing those puts a card in a selector that the shopper never
   *   consented to see again.
   */
  async listPaymentMethods(input: ListPaymentMethodsInput): Promise<ListPaymentMethodsOutput> {
    const customerId = accountHolderIdOf(input.context)

    const [customer, methods] = await Promise.all([
      this.gateway('retrieveAccountHolder', () => this.stripe.customers.retrieve(customerId)),
      this.gateway('listPaymentMethods', () =>
        this.stripe.customers.listPaymentMethods(customerId, {
          limit: SAVED_METHOD_LIMIT,
          // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
          allow_redisplay: 'always',
        }),
      ),
    ])

    return toSavedMethods(methods.data, defaultMethodIdOf(customer))
  }

  async savePaymentMethod(input: SavePaymentMethodInput): Promise<SavePaymentMethodOutput> {
    const customerId = accountHolderIdOf(input.context)
    const setupIntent = await this.gateway('savePaymentMethod', () =>
      this.stripe.setupIntents.create({
        customer: customerId,
        ...(input.data as Stripe.SetupIntentCreateParams),
      }),
    )
    return { id: setupIntent.id, data: setupIntent as unknown as Record<string, unknown> }
  }

  async deletePaymentMethod(input: DeletePaymentMethodInput): Promise<DeletePaymentMethodOutput> {
    const customerId = accountHolderIdOf(input.context)
    const methodId = methodIdOf(input.data)

    await this.assertOwned(customerId, methodId)
    await this.gateway('deletePaymentMethod', () => this.stripe.paymentMethods.detach(methodId))
    return {}
  }

  /**
   * The default lives on the Stripe Customer, which is the field Stripe itself treats as one.
   *
   * No Proteus table and no migration: a second copy of "which card is default" is a second
   * thing to keep in step, and the gateway's copy is the one that decides.
   */
  async setDefaultPaymentMethod(input: SetDefaultPaymentMethodInput): Promise<SetDefaultPaymentMethodOutput> {
    const customerId = accountHolderIdOf(input.context)
    const methodId = methodIdOf(input.data)

    await this.assertOwned(customerId, methodId)
    await this.gateway('setDefaultPaymentMethod', () =>
      this.stripe.customers.update(customerId, {
        // biome-ignore lint/style/useNamingConvention: Stripe SDK parameter
        invoice_settings: { default_payment_method: methodId },
      }),
    )
    return {}
  }

  // -- Helpers --

  /**
   * Ownership, asked of the gateway rather than inferred from the route's authentication.
   *
   * "Authenticated and scoped to the requesting customer" is necessary and not sufficient: the id
   * in the path is whatever was typed, and `@medusajs/payment-stripe` detaches whatever it is
   * handed. `customers.retrievePaymentMethod` is the check that cannot be skipped by accident,
   * because the customer is part of the URL rather than a filter someone remembered to apply.
   *
   * Stripe answers a method that does not exist with `resource_missing`, and one that exists but
   * belongs to somebody else with a bare 404 — it declines to confirm another customer's method
   * is real. `classifyGatewayError` collapses both into the one answer the wallet has for either:
   * that card is gone, refresh.
   */
  private async assertOwned(customerId: string, methodId: string): Promise<Stripe.PaymentMethod> {
    return this.gateway('retrievePaymentMethod', () =>
      this.stripe.customers.retrievePaymentMethod(customerId, methodId),
    )
  }

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
    isSettled: (error: Stripe.errors.StripeError) => Promise<boolean>,
  ): Promise<T | undefined>
  private async gateway<T>(
    operation: string,
    call: () => Promise<T>,
    isSettled?: (error: Stripe.errors.StripeError) => Promise<boolean>,
  ): Promise<T | undefined> {
    const attempts = this.config.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS
    const backoffMs = this.config.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS

    for (let attempt = 1; ; attempt++) {
      try {
        return await call()
      } catch (error) {
        if (isStripeError(error) && isSettled && (await isSettled(error))) {
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

  /**
   * Recognises the one refusal that means the gateway is already where the call was trying to put
   * it — and nothing else.
   *
   * The trap: Stripe answers `payment_intent_unexpected_state` to a capture against a *cancelled*
   * intent, and to one still requiring a payment method, still confirming, still processing, or
   * waiting on an action. Reading the code alone calls every one of those a success, and the
   * ledger then records a capture the gateway never made. So the intent's real status decides,
   * and only the status this operation was driving towards counts as settled.
   */
  private settledAt(id: string, ...settled: Stripe.PaymentIntent.Status[]) {
    return async (error: Stripe.errors.StripeError): Promise<boolean> => {
      if (error.code !== 'payment_intent_unexpected_state') return false
      const status = await this.intentStatusOf(error, id)
      return status !== undefined && settled.includes(status)
    }
  }

  /**
   * Stripe usually attaches the offending intent to the error, which saves the round trip. When it
   * does not, ask — and if asking fails, answer `undefined` so the caller treats the original
   * failure as a failure. Guessing in the other direction is what writes phantom money.
   */
  private async intentStatusOf(
    error: Stripe.errors.StripeError,
    id: string,
  ): Promise<Stripe.PaymentIntent.Status | undefined> {
    const attached = error.payment_intent
    if (attached?.status) return attached.status

    try {
      const intent = await this.stripe.paymentIntents.retrieve(id)
      return intent.status
    } catch (retrieveError) {
      this.logger.error(gatewayFailureLog(`settledAt(${id})`, retrieveError))
      return undefined
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
  private async verifyEvent(rawData: string | Uint8Array, signature: string): Promise<Stripe.Event> {
    try {
      // `constructEvent`, the synchronous one, throws `CryptoProviderOnlySupportsAsyncError` on
      // any runtime without node:crypto — workerd falls back to SubtleCrypto, which has no
      // synchronous digest. A validly signed event answered 500 there and 200 on Node.
      return await this.stripe.webhooks.constructEventAsync(rawData, signature, this.config.webhookSecret)
    } catch (error) {
      if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
        throw new AppError({ type: ErrorTypes.INVALID_DATA, message: 'Webhook signature verification failed' })
      }
      throw error
    }
  }
}

/**
 * A refund the gateway has already made in full. Unlike the intent-state codes this one names its
 * own outcome exactly, so the code is the whole answer and no status read is needed.
 *
 * Reads the gateway's own error code, which only `gateway()` still sees — what it rethrows is our
 * error, carrying our code and none of Stripe's wording.
 */
const alreadyRefunded = async (error: Stripe.errors.StripeError) => error.code === 'charge_already_refunded'
