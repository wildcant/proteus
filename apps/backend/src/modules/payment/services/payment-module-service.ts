import { BigNumber } from '../../../core/bignumber.js'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import { PAYMENT_METHOD_UNAVAILABLE } from '../../../core/errors/payment-method-code.js'
import type { FindConfig } from '../../../core/types/common.js'
import type { Context } from '../../../core/types/context.js'
import type { Logger } from '../../../core/types/logger.js'
import type {
  AccountHolderDTO,
  AuthorizePaymentSessionResult,
  FilterableAccountHolderProps,
  FilterablePaymentProviderProps,
  PaymentCollectionDTO,
  PaymentCollectionStatus,
  PaymentDTO,
  PaymentProviderDTO,
  PaymentProviderMeta,
  PaymentSessionDTO,
  PaymentSessionStatus,
  RefundReasonDTO,
  SavedMethodDTO,
} from '../../../core/types/payment/common.js'
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
} from '../../../core/types/payment/mutations.js'
import type { IPaymentModuleService } from '../../../core/types/payment/service.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import { idempotencyKeyFor } from '../idempotency-keys.js'
import type { AccountHolderRepository } from '../repositories/account-holder.js'
import type { CaptureRepository } from '../repositories/capture.js'
import type { PaymentRepository } from '../repositories/payment.js'
import type { PaymentCollectionRepository } from '../repositories/payment-collection.js'
import type { PaymentSessionRepository } from '../repositories/payment-session.js'
import type { RefundRepository } from '../repositories/refund.js'
import type { RefundReasonRepository } from '../repositories/refund-reason.js'
import { orderSavedMethods } from '../saved-methods.js'
import type { PaymentProviderService } from './payment-provider-service.js'

/**
 * The statuses in which a session has not become money and can safely be abandoned.
 *
 * `authorized`, `captured` and `pending_authorization` are deliberately absent: each of those is
 * a claim on the shopper's funds that something else in the system is accounting for, and
 * quietly cancelling one would leave the ledger describing money that no longer exists.
 */
const SUPERSEDABLE_SESSION_STATUSES: ReadonlySet<PaymentSessionStatus> = new Set([
  'pending',
  'requires_more',
  'error',
  'canceled',
])

type InjectedDependencies = {
  paymentCollectionRepository: PaymentCollectionRepository
  paymentSessionRepository: PaymentSessionRepository
  paymentRepository: PaymentRepository
  captureRepository: CaptureRepository
  refundRepository: RefundRepository
  refundReasonRepository: RefundReasonRepository
  accountHolderRepository: AccountHolderRepository
  paymentProviderService: PaymentProviderService
  withTransaction: WithTransaction
  logger: Logger
}

export class PaymentModuleService implements IPaymentModuleService {
  private paymentCollectionRepository: PaymentCollectionRepository
  private paymentSessionRepository: PaymentSessionRepository
  private paymentRepository: PaymentRepository
  private captureRepository: CaptureRepository
  private refundRepository: RefundRepository
  private refundReasonRepository: RefundReasonRepository
  private accountHolderRepository: AccountHolderRepository
  private paymentProviderService: PaymentProviderService
  private withTransaction: WithTransaction
  private logger: Logger

  constructor({
    paymentCollectionRepository,
    paymentSessionRepository,
    paymentRepository,
    captureRepository,
    refundRepository,
    refundReasonRepository,
    accountHolderRepository,
    paymentProviderService,
    withTransaction,
    logger,
  }: InjectedDependencies) {
    this.paymentCollectionRepository = paymentCollectionRepository
    this.paymentSessionRepository = paymentSessionRepository
    this.paymentRepository = paymentRepository
    this.captureRepository = captureRepository
    this.refundRepository = refundRepository
    this.refundReasonRepository = refundReasonRepository
    this.accountHolderRepository = accountHolderRepository
    this.paymentProviderService = paymentProviderService
    this.withTransaction = withTransaction
    this.logger = logger
  }

  // ---------------------------------------------------------------------------
  // PaymentCollection CRUD
  // ---------------------------------------------------------------------------

  async createPaymentCollections(
    data: CreatePaymentCollectionDTO[],
    context?: Context,
  ): Promise<PaymentCollectionDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      const rows = data.map((d) => ({
        amount: d.amount,
        currencyCode: d.currencyCode ?? 'usd',
        status: 'not_paid' as const,
        metadata: d.metadata ?? null,
      }))
      return this.paymentCollectionRepository.createMany(rows, ctx)
    })
  }

  async retrievePaymentCollection(
    id: string,
    config?: FindConfig<PaymentCollectionDTO>,
    context?: Context,
  ): Promise<PaymentCollectionDTO> {
    const collection = await this.paymentCollectionRepository.findByIdOrFail(id, config, context)

    const [sessions, payments] = await Promise.all([
      this.paymentSessionRepository.find({ paymentCollectionId: id }, undefined, context),
      this.paymentRepository.find({ paymentCollectionId: id }, undefined, context),
    ])

    const paymentsWithRelations = await Promise.all(
      payments.map((p) => this.retrievePaymentWithRelations_(p.id, context)),
    )

    return { ...collection, paymentSessions: sessions, payments: paymentsWithRelations }
  }

  async updatePaymentCollections(
    ids: string[],
    data: UpdatePaymentCollectionDTO,
    context?: Context,
  ): Promise<PaymentCollectionDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.paymentCollectionRepository.updateMany(ids, data, ctx)
    })
  }

  async createPaymentCollection(data: CreatePaymentCollectionDTO, context?: Context): Promise<PaymentCollectionDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.paymentCollectionRepository.create(
        {
          amount: data.amount,
          currencyCode: data.currencyCode ?? 'usd',
          status: 'not_paid' as const,
          metadata: data.metadata ?? null,
        },
        ctx,
      )
    })
  }

  async updatePaymentCollection(
    id: string,
    data: UpdatePaymentCollectionDTO,
    context?: Context,
  ): Promise<PaymentCollectionDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.paymentCollectionRepository.update(id, data, ctx)
    })
  }

  async softDeletePaymentCollections(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.paymentCollectionRepository.softDelete(ids, ctx)
    })
  }

  async restorePaymentCollections(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.paymentCollectionRepository.restore(ids, ctx)
    })
  }

  // ---------------------------------------------------------------------------
  // PaymentSession lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Opens a session for a collection, abandoning every attempt on it that has not become money.
   *
   * `createPaymentSession` adds; this replaces, and the caller picks. Adding is the module's
   * default because a collection can legitimately carry several sessions — that is how one total
   * is split across two providers — so the module cannot decide for everyone.
   *
   * A checkout wants the other thing. Every Place order press opens a session, so a shopper who
   * is declined and reaches for a second card would otherwise leave two: two intents at the
   * gateway, one of them confirmed, and cart completion authorizing whichever the database
   * happened to return first. The observed failure is the worse half — the second card is
   * authorized at Stripe, the server authorizes the first, completion fails, and the shopper is
   * left holding an authorization against a card that bought nothing.
   *
   * Superseded sessions are cancelled at the gateway rather than merely forgotten, so a shopper
   * who tries three cards leaves no authorization standing against any of them.
   */
  async replacePaymentSession(
    paymentCollectionId: string,
    input: CreatePaymentSessionDTO,
    context?: Context,
  ): Promise<PaymentSessionDTO> {
    const collection = await this.retrievePaymentCollection(paymentCollectionId, undefined, context)
    const superseded = (collection.paymentSessions ?? []).filter((session) =>
      SUPERSEDABLE_SESSION_STATUSES.has(session.status),
    )

    // Sequential rather than `Promise.all`: each of these recomputes the collection's status, so
    // running them together would have two writers on one row.
    for (const session of superseded) {
      this.logger.debug(`Superseding payment session "${session.id}" (${session.status}) before opening a new one`)
      // Deliberately not swallowed. A cancellation that fails is the one case where opening a
      // second attempt is worse than refusing: the first may have taken money. The shopper sees
      // the failure and can press again — the cancel carries a stable idempotency key, so the
      // second attempt at it is the same operation rather than a new one.
      await this.deletePaymentSession(session.id, context)
    }

    return this.createPaymentSession(paymentCollectionId, input, context)
  }

  async createPaymentSession(
    paymentCollectionId: string,
    input: CreatePaymentSessionDTO,
    context?: Context,
  ): Promise<PaymentSessionDTO> {
    this.logger.debug(
      `Creating payment session for collection "${paymentCollectionId}" with provider "${input.providerId}"`,
    )
    const collection = await this.paymentCollectionRepository.findByIdOrFail(paymentCollectionId, undefined, context)

    const amount = input.amount
    const currencyCode = input.currencyCode ?? collection.currencyCode

    const session = await this.paymentSessionRepository.create(
      {
        paymentCollectionId: collection.id,
        providerId: input.providerId,
        currencyCode,
        amount,
        status: 'pending',
        data: input.data ?? {},
        context: input.context ?? null,
        metadata: null,
      },
      context,
    )

    try {
      const provider = await this.paymentProviderService.createSession(input.providerId, {
        amount,
        currencyCode,
        data: { ...input.data, sessionId: session.id },
        // The session row is written first precisely so its id can key this call: a retry after
        // a crash mid-create presents the same key and cannot open a second intent.
        context: { ...input.context, idempotencyKey: idempotencyKeyFor('initiate', session.id) },
      })

      const updated = await this.paymentSessionRepository.update(
        session.id,
        {
          data: provider.data ?? input.data ?? {},
          status: provider.status ?? 'pending',
        },
        context,
      )

      await this.maybeUpdatePaymentCollection_(paymentCollectionId, context)

      return updated
    } catch (error) {
      await this.paymentSessionRepository.delete([session.id], context)
      await this.paymentProviderService
        .deleteSession(input.providerId, {
          data: session.data,
          context: { idempotencyKey: idempotencyKeyFor('cancel', session.id) },
        })
        .catch((e) => this.logger.error(e))
      throw error
    }
  }

  /**
   * Re-prices an open session against a total the caller has already computed server-side.
   *
   * With deferred creation the session is normally opened at the total it will be charged at, so
   * this path is the exception rather than the defence: a redirect return, or a retry, can still
   * find a session that predates a cart change. The full provider blob comes back because the
   * storefront is mid-checkout holding a client secret from it — returning a partial one would
   * strand it.
   */
  async updatePaymentSession(id: string, data: UpdatePaymentSessionDTO, context?: Context): Promise<PaymentSessionDTO> {
    const session = await this.paymentSessionRepository.findByIdOrFail(id, undefined, context)

    const amount = data.amount ?? session.amount
    const currencyCode = data.currencyCode ?? session.currencyCode

    // Nothing changed, so nothing is sent. The gateway charges for the round trip in latency the
    // shopper is waiting on, and an update to the amount already on the intent buys nothing.
    if (amount.isEqualTo(session.amount) && currencyCode === session.currencyCode) {
      this.logger.debug(`Payment session "${id}" already stands at ${amount.toFixed()} ${currencyCode}; not updating`)
      return session
    }

    this.logger.debug(`Updating payment session "${id}" to ${amount.toFixed()} ${currencyCode}`)

    const provider = await this.paymentProviderService.updateSession(session.providerId, {
      amount,
      currencyCode,
      data: session.data,
      // Two updates to different totals are two operations; the target is part of the key so the
      // gateway does not reject the second as a replay of the first with changed parameters.
      context: {
        ...(session.context ?? {}),
        idempotencyKey: idempotencyKeyFor('update', session.id, amount.toFixed(), currencyCode),
      },
    })

    const updated = await this.paymentSessionRepository.update(
      session.id,
      { amount, currencyCode, data: provider.data ?? session.data },
      context,
    )

    await this.maybeUpdatePaymentCollection_(session.paymentCollectionId, context)

    return updated
  }

  async authorizePaymentSession(id: string, context?: Context): Promise<AuthorizePaymentSessionResult> {
    this.logger.debug(`Authorizing payment session "${id}"`)
    const session = await this.paymentSessionRepository.findByIdOrFail(id, undefined, context)

    // Idempotent — safe to call multiple times
    const payment = await this.paymentRepository.findOne({ paymentSessionId: session.id }, undefined, context)
    if (payment && (payment.capturedAt || session.status === 'authorized')) {
      return { outcome: 'authorized', payment: await this.retrievePaymentWithRelations_(payment.id, context) }
    }

    const provider = await this.paymentProviderService.authorizePayment(session.providerId, {
      data: session.data,
      context: session.context ?? undefined,
    })

    const status = provider.status
    this.logger.debug(`Provider returned status "${status}" for session "${id}"`)

    // Always sync our session with what the provider told us
    await this.paymentSessionRepository.update(
      session.id,
      {
        status,
        data: provider.data ?? session.data,
        authorizedAt: status === 'authorized' || status === 'captured' ? new Date() : null,
      },
      context,
    )

    // Confirmed at the provider and still settling — an asynchronous method, or a card the
    // gateway has not finished deciding on. There is no payment yet and nothing has failed: the
    // webhook that resolves the intent calls this again and creates one then.
    if (status === 'pending_authorization') return { outcome: 'pending_authorization' }

    // Provider declined or needs more input — no payment to create
    if (status !== 'authorized' && status !== 'captured') {
      await this.maybeUpdatePaymentCollection_(session.paymentCollectionId, context)
      return { outcome: 'not_authorized', sessionStatus: status }
    }

    // If anything below fails, cancel at the provider so we don't leave a dangling authorization
    try {
      const payment = await this.paymentRepository.create(
        {
          paymentCollectionId: session.paymentCollectionId,
          paymentSessionId: session.id,
          amount: session.amount,
          currencyCode: session.currencyCode,
          providerId: session.providerId,
          data: provider.data ?? session.data,
        },
        context,
      )

      // Some providers authorize and capture in one step
      if (status === 'captured') {
        await this.capturePayment({ paymentId: payment.id }, context)
      }

      await this.maybeUpdatePaymentCollection_(session.paymentCollectionId, context)

      return { outcome: 'authorized', payment: await this.retrievePaymentWithRelations_(payment.id, context) }
    } catch (error) {
      await this.paymentProviderService.cancelPayment(session.providerId, {
        data: session.data,
        context: { idempotencyKey: idempotencyKeyFor('cancel', session.id) },
      })
      throw error
    }
  }

  /**
   * Destroys the session at the provider, then hides our record of it.
   *
   * The destructive verb, not `softDelete`, and for the same reason `deleteAccountHolder` keeps
   * it: the half that matters happens at Stripe, where retention is not ours to control. A
   * `restore` would bring back a row describing a session that no longer exists.
   */
  async deletePaymentSession(id: string, context?: Context): Promise<void> {
    const session = await this.paymentSessionRepository.findByIdOrFail(id, undefined, context)

    await this.paymentProviderService.deleteSession(session.providerId, {
      data: session.data,
      context: { idempotencyKey: idempotencyKeyFor('cancel', session.id) },
    })
    await this.paymentSessionRepository.softDelete([session.id], context)
    await this.maybeUpdatePaymentCollection_(session.paymentCollectionId, context)
  }

  // ---------------------------------------------------------------------------
  // Payment retrieval
  // ---------------------------------------------------------------------------

  async retrievePayment(id: string, context?: Context): Promise<PaymentDTO> {
    return this.retrievePaymentWithRelations_(id, context)
  }

  // ---------------------------------------------------------------------------
  // Payment lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Takes the whole authorization. A capture is all-or-nothing: no gateway adapter here can take
   * part of one — Stripe's capture call carries no `amount_to_capture` and charges the entire
   * intent — so a partial capture would write a Capture row for less than the shopper was
   * actually charged and leave the ledger disagreeing with the money. Refunds are the partial
   * operation; see *Partial capture* in the spec's Out of Scope.
   */
  async capturePayment(data: CreateCaptureDTO, context?: Context): Promise<PaymentDTO> {
    this.logger.debug(`Capturing payment "${data.paymentId}"`)
    return this.withTransaction(context, async (ctx) => {
      const payment = await this.paymentRepository.findByIdOrFail(data.paymentId, undefined, ctx)

      if (payment.canceledAt) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Payment "${payment.id}" has been canceled and cannot be captured.`,
        })
      }

      // Read from the capture rows rather than `capturedAt`, because the rows are the ledger: they
      // decide both what is taken and whether there is anything left to take.
      const existingCaptures = await this.captureRepository.find({ paymentId: payment.id }, undefined, ctx)
      const alreadyCaptured = existingCaptures.reduce((sum, c) => sum.plus(c.amount), new BigNumber(0))
      const captureAmount = payment.amount.minus(alreadyCaptured)

      // Nothing outstanding means the money is already taken. A gateway redelivering its own
      // completed-charge event lands here, so this has to be a refusal the caller can recognise
      // rather than a second charge.
      if (captureAmount.isLessThanOrEqualTo(0)) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Payment "${payment.id}" has already been fully captured.`,
        })
      }

      // The outstanding-amount check above is what stops a second charge here; the key is not.
      // This row is created inside the transaction, so a crash between the insert and the
      // gateway's acknowledgement rolls it back and the retry keys off a *different* row id. That
      // is survivable only because a capture takes the whole authorization: the check refuses the
      // retry when the first attempt landed, and Stripe refuses a second capture on an intent it
      // has already captured. A refund has neither backstop — see `refundPayment`.
      const capture = await this.captureRepository.create(
        {
          paymentId: payment.id,
          amount: captureAmount,
          createdBy: data.capturedBy ?? null,
        },
        ctx,
      )

      await this.paymentProviderService.capturePayment(payment.providerId, {
        data: payment.data ?? undefined,
        context: { idempotencyKey: idempotencyKeyFor('capture', capture.id) },
      })

      // The capture took everything outstanding, so this is the first and only one.
      await this.paymentRepository.update(payment.id, { capturedAt: new Date() }, ctx)

      await this.maybeUpdatePaymentCollection_(payment.paymentCollectionId, ctx)

      return this.retrievePaymentWithRelations_(payment.id, ctx)
    })
  }

  async refundPayment(data: CreateRefundDTO, context?: Context): Promise<PaymentDTO> {
    this.logger.debug(`Refunding payment "${data.paymentId}"${data.amount ? ` for amount ${data.amount}` : ''}`)
    return this.withTransaction(context, async (ctx) => {
      const payment = await this.paymentRepository.findByIdOrFail(data.paymentId, undefined, ctx)

      // Can only refund what was captured minus what was already refunded
      const existingCaptures = await this.captureRepository.find({ paymentId: payment.id }, undefined, ctx)
      const totalCaptured = existingCaptures.reduce((sum, c) => sum.plus(c.amount), new BigNumber(0))

      const existingRefunds = await this.refundRepository.find({ paymentId: payment.id }, undefined, ctx)
      const alreadyRefunded = existingRefunds.reduce((sum, r) => sum.plus(r.amount), new BigNumber(0))

      const refundableAmount = totalCaptured.minus(alreadyRefunded)
      const refundAmount = data.amount ?? refundableAmount

      if (refundAmount.isLessThanOrEqualTo(0)) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Payment "${payment.id}" has no refundable amount remaining.`,
        })
      }

      if (refundAmount.isGreaterThan(refundableAmount)) {
        throw new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: `Refund amount ${refundAmount.toFixed()} exceeds refundable amount ${refundableAmount.toFixed()}.`,
        })
      }

      // Keyed off the refund row's id, this would not survive a rollback: the retry after a crash
      // inserts a new row, presents a new key, and Stripe makes a *second* refund. Nothing
      // upstream objects, because the rolled-back row is gone from `alreadyRefunded` too and a
      // partial refund never trips `charge_already_refunded`. So the key is composed from three
      // values that a rollback cannot change — which payment, how much was already refunded
      // before this one, and how much this one is for. Two genuine partial refunds of the same
      // amount still differ, because the second sees the first in `alreadyRefunded`.
      const refundKey = idempotencyKeyFor('refund', payment.id, alreadyRefunded.toFixed(), refundAmount.toFixed())

      await this.refundRepository.create(
        {
          paymentId: payment.id,
          amount: refundAmount,
          refundReasonId: data.refundReasonId ?? null,
          note: data.note ?? null,
          createdBy: data.createdBy ?? null,
        },
        ctx,
      )

      const provider = await this.paymentProviderService.refundPayment(payment.providerId, {
        amount: refundAmount,
        currencyCode: payment.currencyCode,
        data: payment.data ?? undefined,
        context: { idempotencyKey: refundKey },
      })

      // Provider may return updated payment data (e.g. refund reference id)
      if (provider.data) {
        await this.paymentRepository.update(payment.id, { data: provider.data }, ctx)
      }

      await this.maybeUpdatePaymentCollection_(payment.paymentCollectionId, ctx)

      return this.retrievePaymentWithRelations_(payment.id, ctx)
    })
  }

  async cancelPayment(paymentId: string, context?: Context): Promise<PaymentDTO> {
    this.logger.debug(`Canceling payment "${paymentId}"`)
    return this.withTransaction(context, async (ctx) => {
      const payment = await this.paymentRepository.findByIdOrFail(paymentId, undefined, ctx)

      if (payment.canceledAt) {
        return this.retrievePaymentWithRelations_(payment.id, ctx)
      }

      await this.paymentProviderService.cancelPayment(payment.providerId, {
        data: payment.data ?? undefined,
        context: { idempotencyKey: idempotencyKeyFor('cancel', payment.paymentSessionId) },
      })

      await this.paymentRepository.update(payment.id, { canceledAt: new Date() }, ctx)

      await this.maybeUpdatePaymentCollection_(payment.paymentCollectionId, ctx)

      return this.retrievePaymentWithRelations_(payment.id, ctx)
    })
  }

  // ---------------------------------------------------------------------------
  // Providers
  // ---------------------------------------------------------------------------

  async listPaymentProviders(
    filters?: FilterablePaymentProviderProps,
    config?: FindConfig<PaymentProviderDTO>,
    context?: Context,
  ): Promise<PaymentProviderDTO[]> {
    return this.paymentProviderService.list(filters, config, context)
  }

  getProviderMeta(providerId: string): PaymentProviderMeta {
    return this.paymentProviderService.getProviderMeta(providerId)
  }

  // ---------------------------------------------------------------------------
  // Webhooks
  // ---------------------------------------------------------------------------

  async getWebhookActionAndData(data: ProviderWebhookPayload): Promise<WebhookActionResult> {
    return this.paymentProviderService.getWebhookActionAndData(data.provider, data.payload)
  }

  // ---------------------------------------------------------------------------
  // AccountHolder
  // ---------------------------------------------------------------------------

  async createAccountHolder(input: CreateAccountHolderDTO, context?: Context): Promise<AccountHolderDTO> {
    const provider = await this.paymentProviderService.createAccountHolder(input.providerId, {
      data: input.data,
      context: { email: input.email, customerId: input.customerId },
    })

    return this.accountHolderRepository.create(
      {
        providerId: input.providerId,
        externalId: provider?.id ?? input.externalId,
        customerId: input.customerId ?? null,
        email: input.email ?? null,
        data: provider?.data ?? input.data ?? {},
        metadata: input.metadata ?? null,
      },
      context,
    )
  }

  async listAccountHolders(
    filters?: FilterableAccountHolderProps,
    config?: FindConfig<AccountHolderDTO>,
    context?: Context,
  ): Promise<AccountHolderDTO[]> {
    return this.accountHolderRepository.find(filters, config, context)
  }

  /**
   * The customer's account holder at every enabled provider that has the concept, created on
   * first need and never twice.
   *
   * Lazy because nothing at a gateway should exist for a shopper who has not reached the payment
   * step, and a guest must leave no trace there at all — which is why the caller, not this
   * module, decides whether a Customer row is an *account* (`hasAccount`). By the time it is
   * called the answer is yes.
   *
   * Idempotent in both directions, because one is not enough. The gateway is given a key derived
   * from the customer id, so two checkouts opening at once cannot leave two Stripe Customers;
   * the unique index on (provider, customer) decides which of the two rows survives, and the
   * loser reads back the winner's. A read-then-write alone would let both callers through.
   */
  async ensureAccountHolders(input: EnsureAccountHoldersDTO, context?: Context): Promise<AccountHolderDTO[]> {
    const existing = await this.accountHolderRepository.find({ customerId: input.customerId }, undefined, context)
    const providers = await this.paymentProviderService.list({ isEnabled: true }, undefined, context)
    const missing = providers.filter((provider) => !existing.some((holder) => holder.providerId === provider.id))

    const created = await Promise.all(
      missing.map((provider) => this.createAccountHolderFor_(provider.id, input, context)),
    )

    return [...existing, ...created.filter((holder): holder is AccountHolderDTO => holder !== null)]
  }

  /** Null when the provider has no account-holder concept: nothing to create, nothing to store. */
  private async createAccountHolderFor_(
    providerId: string,
    input: EnsureAccountHoldersDTO,
    context?: Context,
  ): Promise<AccountHolderDTO | null> {
    const provider = await this.paymentProviderService.createAccountHolder(providerId, {
      context: {
        customerId: input.customerId,
        email: input.email,
        name: input.name,
        idempotencyKey: idempotencyKeyFor('accountHolder', input.customerId, providerId),
      },
    })

    if (!provider) return null

    try {
      return await this.accountHolderRepository.create(
        {
          providerId,
          externalId: provider.id,
          customerId: input.customerId,
          email: input.email ?? null,
          data: provider.data ?? {},
          metadata: null,
        },
        context,
      )
    } catch (error) {
      // Lost the race against a concurrent checkout. Both asked the gateway with the same
      // idempotency key, so both are holding the same external id and either row would do — but
      // only one may exist, so this one reads the winner's rather than failing the shopper.
      if (!AppError.isError(error) || error.type !== ErrorTypes.DUPLICATE_ERROR) throw error

      const winner = await this.accountHolderRepository.findOne(
        { providerId, customerId: input.customerId },
        undefined,
        context,
      )
      if (!winner) throw error
      return winner
    }
  }

  async deleteAccountHolder(id: string, context?: Context): Promise<void> {
    const accountHolder = await this.accountHolderRepository.findByIdOrFail(id, undefined, context)

    await this.paymentProviderService.deleteAccountHolder(accountHolder.providerId, {
      data: accountHolder.data,
    })

    await this.accountHolderRepository.softDelete([id], context)
  }

  // ---------------------------------------------------------------------------
  // The wallet (provider-managed, no DB table)
  // ---------------------------------------------------------------------------

  /**
   * Everything the customer has stored, at every provider they hold an account with.
   *
   * Keyed by the customer rather than by a provider, because a wallet is the shopper's and a
   * caller that had to name the provider would be guessing on their behalf. Ordering is applied
   * here, once, over the merged list — see `orderSavedMethods`.
   */
  async listSavedMethods(customerId: string, context?: Context): Promise<SavedMethodDTO[]> {
    const holders = await this.accountHolderRepository.find({ customerId }, undefined, context)

    const lists = await Promise.all(
      holders.map((holder) =>
        this.paymentProviderService.listPaymentMethods(holder.providerId, {
          context: { accountHolder: holder },
        }),
      ),
    )

    return orderSavedMethods(lists.flatMap((list) => list ?? []))
  }

  /**
   * Detaches a method the customer holds.
   *
   * The account holders are the candidates, and each provider is asked about the id in turn —
   * the gateway decides whether it is theirs, not a filter written here. A method no provider
   * claims is answered the same way a stale one is, because from the wallet's point of view they
   * are the same thing: refresh, the card is gone.
   */
  async deleteSavedMethod(customerId: string, methodId: string, context?: Context): Promise<void> {
    await this.overOwningProvider_(
      customerId,
      methodId,
      (holder) =>
        this.paymentProviderService.deletePaymentMethod(holder.providerId, {
          data: { id: methodId },
          context: { accountHolder: holder },
        }),
      context,
    )
  }

  /** Nominates the customer's default. Stored by the gateway, never by Proteus. */
  async setDefaultSavedMethod(customerId: string, methodId: string, context?: Context): Promise<void> {
    await this.overOwningProvider_(
      customerId,
      methodId,
      (holder) =>
        this.paymentProviderService.setDefaultPaymentMethod(holder.providerId, {
          data: { id: methodId },
          context: { accountHolder: holder },
        }),
      context,
    )
  }

  /**
   * Runs a wallet write against whichever of the customer's providers owns the method.
   *
   * `undefined` from the delegate means the provider does not have the operation at all, which
   * is indistinguishable here from "not this provider's method" — both mean "ask the next one".
   * That is what keeps `setDefaultPaymentMethod` genuinely optional: a provider without it needs
   * no stub, and nothing here calls a method that is not there.
   */
  private async overOwningProvider_<T>(
    customerId: string,
    methodId: string,
    write: (holder: AccountHolderDTO) => Promise<T | undefined>,
    context?: Context,
  ): Promise<void> {
    const holders = await this.accountHolderRepository.find({ customerId }, undefined, context)

    for (const holder of holders) {
      try {
        const result = await write(holder)
        if (result !== undefined) return
      } catch (error) {
        // Only the gateway's "that is not this customer's method" moves on to the next provider.
        // Anything else — the gateway is down, our key is wrong — is the caller's answer.
        if (!AppError.isError(error) || error.code !== PAYMENT_METHOD_UNAVAILABLE) throw error
        this.logger.debug(`Payment method "${methodId}" is not held at provider "${holder.providerId}"`)
      }
    }

    throw new AppError({
      type: ErrorTypes.CONFLICT,
      code: PAYMENT_METHOD_UNAVAILABLE,
      message: 'That payment method is no longer available.',
    })
  }

  // ---------------------------------------------------------------------------
  // RefundReason CRUD
  // ---------------------------------------------------------------------------

  async createRefundReasons(data: CreateRefundReasonDTO[], context?: Context): Promise<RefundReasonDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.refundReasonRepository.createMany(data, ctx)
    })
  }

  async listRefundReasons(context?: Context): Promise<RefundReasonDTO[]> {
    return this.refundReasonRepository.find(undefined, undefined, context)
  }

  async updateRefundReasons(ids: string[], data: UpdateRefundReasonDTO, context?: Context): Promise<RefundReasonDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.refundReasonRepository.updateMany(ids, data, ctx)
    })
  }

  async createRefundReason(data: CreateRefundReasonDTO, context?: Context): Promise<RefundReasonDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.refundReasonRepository.create(data, ctx)
    })
  }

  async updateRefundReason(id: string, data: UpdateRefundReasonDTO, context?: Context): Promise<RefundReasonDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.refundReasonRepository.update(id, data, ctx)
    })
  }

  async softDeleteRefundReasons(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.refundReasonRepository.softDelete(ids, ctx)
    })
  }

  async restoreRefundReasons(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.refundReasonRepository.restore(ids, ctx)
    })
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async retrievePaymentWithRelations_(paymentId: string, context?: Context): Promise<PaymentDTO> {
    const payment = await this.paymentRepository.findByIdOrFail(paymentId, undefined, context)
    const [captures, refunds] = await Promise.all([
      this.captureRepository.find({ paymentId: payment.id }, undefined, context),
      this.refundRepository.find({ paymentId: payment.id }, undefined, context),
    ])
    return { ...payment, captures, refunds }
  }

  private async maybeUpdatePaymentCollection_(collectionId: string, context?: Context): Promise<void> {
    const collection = await this.paymentCollectionRepository.findByIdOrFail(collectionId, undefined, context)

    const sessions = await this.paymentSessionRepository.find({ paymentCollectionId: collectionId }, undefined, context)
    const payments = await this.paymentRepository.find({ paymentCollectionId: collectionId }, undefined, context)

    const paymentIds = payments.map((p) => p.id)
    const [captures, refunds] =
      paymentIds.length > 0
        ? await Promise.all([
            this.captureRepository.find({ paymentId: paymentIds }, undefined, context),
            this.refundRepository.find({ paymentId: paymentIds }, undefined, context),
          ])
        : [[], []]

    const authorizedAmount = sessions
      .filter((s) => s.status === 'authorized')
      .reduce((sum, s) => sum.plus(s.amount), new BigNumber(0))
    const capturedAmount = captures.reduce((sum, c) => sum.plus(c.amount), new BigNumber(0))
    const refundedAmount = refunds.reduce((sum, r) => sum.plus(r.amount), new BigNumber(0))

    // Derive status (check most advanced status first)
    let status: PaymentCollectionStatus = 'not_paid'
    let completedAt: Date | null = collection.completedAt

    if (capturedAmount.isGreaterThanOrEqualTo(collection.amount)) {
      status = 'completed'
      completedAt = completedAt ?? new Date()
    } else if (authorizedAmount.isGreaterThanOrEqualTo(collection.amount)) {
      status = 'authorized'
    } else if (authorizedAmount.isGreaterThan(0)) {
      status = 'partially_authorized'
    } else if (sessions.length > 0) {
      status = 'awaiting'
    }

    this.logger.debug(
      `Collection "${collectionId}" status derived as "${status}" (authorized: ${authorizedAmount.toFixed()}, captured: ${capturedAmount.toFixed()}, refunded: ${refundedAmount.toFixed()})`,
    )

    await this.paymentCollectionRepository.update(
      collectionId,
      {
        status,
        authorizedAmount: authorizedAmount.isZero() ? null : authorizedAmount,
        capturedAmount: capturedAmount.isZero() ? null : capturedAmount,
        refundedAmount: refundedAmount.isZero() ? null : refundedAmount,
        completedAt,
      },
      context,
    )
  }
}
