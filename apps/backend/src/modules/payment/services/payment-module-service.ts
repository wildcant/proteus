import { i18n } from '@proteus/utils'
import { BigNumber } from '../../../core/bignumber.js'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
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
import { PaymentErrorCodes } from '../../../core/types/payment/errors.js'
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
} from '../../../core/types/payment/mutations.js'
import type { IPaymentModuleService } from '../../../core/types/payment/service.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { AccountHolderRepository } from '../repositories/account-holder.js'
import type { CaptureRepository } from '../repositories/capture.js'
import type { PaymentRepository } from '../repositories/payment.js'
import type { PaymentCollectionRepository } from '../repositories/payment-collection.js'
import type { PaymentSessionRepository } from '../repositories/payment-session.js'
import type { RefundRepository } from '../repositories/refund.js'
import type { RefundReasonRepository } from '../repositories/refund-reason.js'
import { capturedTotal, refundedTotal, remainingToCapture, sumAmounts } from '../utils/amounts.js'
import { idempotencyKeyFor } from '../utils/idempotency-keys.js'
import { MANUAL_PROVIDER_ID } from '../utils/provider-ids.js'
import { orderSavedMethods } from '../utils/saved-methods.js'
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
      // Newest first, and ordered at all. A collection can hold several live sessions — picking a
      // payment method again opens one beside the one already there, and nothing removes the old
      // one — so a caller reading "the" session off this array is choosing between them. Without
      // an ORDER BY that choice is heap order, which means whether a shopper can check out comes
      // down to which row Postgres happens to return first.
      this.paymentSessionRepository.find({ paymentCollectionId: id }, { order: { createdAt: 'DESC' } }, context),
      this.paymentRepository.find({ paymentCollectionId: id }, undefined, context),
    ])

    const paymentsWithRelations = await Promise.all(payments.map((p) => this.retrievePayment(p.id, context)))

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
   *
   * One attempt is refused instead of superseded: a session at `pending_authorization`. That is
   * confirmed money the gateway has not finished deciding on, so it is not in
   * `SUPERSEDABLE_SESSION_STATUSES` and cancelling it is exactly what that set exists to prevent.
   * Leaving it standing and opening a second session alongside it is the failure described above,
   * reached by a different road — so this refuses, and says so with its own code.
   */
  async replacePaymentSession(
    paymentCollectionId: string,
    input: CreatePaymentSessionDTO,
    context?: Context,
  ): Promise<PaymentSessionDTO> {
    const collection = await this.retrievePaymentCollection(paymentCollectionId, undefined, context)

    /**
     * Before anything is superseded, because the answer is "not now" rather than "not this
     * session": there is nothing to abandon and nothing to open.
     *
     * `pending_authorization` only. `authorized` and `captured` are also unsupersedable and also
     * fall through to `createPaymentSession` today; that predates this guard and is not what it
     * is here for.
     *
     * The message is deliberately the generic one this path already rendered — a shopper whose
     * retry was refused reads the same words as before. The specificity is in `code`, which is
     * where a caller that needs to tell the two apart is meant to read it.
     */
    const settling = (collection.paymentSessions ?? []).find((session) => session.status === 'pending_authorization')
    if (settling) {
      this.logger.debug(`Refusing a new payment session: "${settling.id}" is still settling at the provider`)
      throw new AppError({
        type: ErrorTypes.CONFLICT,
        code: PaymentErrorCodes.ATTEMPT_IN_FLIGHT,
        message: i18n.t('The payment could not be processed.'),
      })
    }

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
      return { outcome: 'authorized', payment: await this.retrievePayment(payment.id, context) }
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

      return { outcome: 'authorized', payment: await this.retrievePayment(payment.id, context) }
    } catch (error) {
      // Except when the session's slot was already taken. The payment's session id is the only
      // unique index reachable in here, so a duplicate means a concurrent caller — checkout and
      // the payment webhook, which is the pair that actually races — created the row first.
      //
      // There is nothing of this caller's to release: `cancelPayment` voids `session.data.id`,
      // the single intent *both* callers authorized, so cancelling here would void the winner's
      // money on a request that changed nothing. Fail loudly and leave the authorization alone,
      // which is what the unique index is for. Converging on the winner's row belongs to the
      // caller's own retry, not here.
      if (AppError.isError(error) && error.type === ErrorTypes.DUPLICATE_ERROR) throw error

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

  async retrievePayment(paymentId: string, context?: Context): Promise<PaymentDTO> {
    const payment = await this.paymentRepository.findByIdOrFail(paymentId, undefined, context)
    const [captures, refunds] = await Promise.all([
      this.captureRepository.find({ paymentId: payment.id }, undefined, context),
      this.refundRepository.find({ paymentId: payment.id }, undefined, context),
    ])
    return { ...payment, captures, refunds }
  }

  // ---------------------------------------------------------------------------
  // Payment lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Takes some or all of what a payment's authorization still holds, under the collection's row
   * lock so a concurrent capture cannot take the same money.
   *
   * Partial only where the provider says it can (`canCapturePartially`): the manual provider takes
   * a deposit and later the rest, while Stripe's adapter captures the entire intent whatever it is
   * asked, so a partial amount against it is refused rather than recorded as less than was charged.
   */
  async capturePayment(data: CreateCaptureDTO, context?: Context): Promise<PaymentDTO> {
    this.logger.debug(`Capturing payment "${data.paymentId}"${data.amount ? ` for amount ${data.amount}` : ''}`)
    return this.withTransaction(context, async (ctx) => {
      const payment = await this.paymentRepository.findByIdOrFail(data.paymentId, undefined, ctx)
      await this.paymentCollectionRepository.lockForUpdate(payment.paymentCollectionId, ctx)

      await this.capture_(payment.id, data, ctx)

      return this.retrievePayment(payment.id, ctx)
    })
  }

  /**
   * Records a payment of `amount` against a collection: what an admin does when a deposit, or the
   * cash-on-delivery rest, arrives for an Order.
   *
   * Medusa's model. The first payment recorded opens a session on the manual provider and
   * authorizes everything the collection still has outstanding; every payment then captures part
   * of that authorization, so the collection reads `partially_captured` until the last one makes it
   * `completed`. A collection that already holds a live manual authorization — a shopper who chose
   * manual payment at checkout — is captured against that one instead of opening a second. Another
   * provider's open authorization is never captured here; see `authorizeManualPayment_`.
   *
   * One transaction, opened by taking the collection's row lock, so the reads that decide what is
   * outstanding cannot be overtaken by a second admin recording a payment at the same moment: the
   * second waits, then sees the first's capture, and is refused if the two would exceed the total.
   * The manual provider is in-process, so holding the transaction across its calls holds no
   * network round trip open.
   */
  async capturePaymentCollection(
    paymentCollectionId: string,
    data: CapturePaymentCollectionDTO,
    context?: Context,
  ): Promise<PaymentDTO> {
    this.logger.debug(`Recording a payment of ${data.amount.toFixed()} on collection "${paymentCollectionId}"`)
    return this.withTransaction(context, async (ctx) => {
      await this.paymentCollectionRepository.lockForUpdate(paymentCollectionId, ctx)

      const recorded = await this.findCaptureByKey_(data.idempotencyKey, ctx)
      if (recorded) return this.retrievePayment(recorded.paymentId, ctx)

      const collection = await this.retrievePaymentCollection(paymentCollectionId, undefined, ctx)
      const payments = collection.payments ?? []

      // Net of refunds, the Order's own definition: Outstanding Amount is the total less the Paid
      // Total, and a refund takes money back out of the Paid Total. After paying 100 and refunding
      // 25, 25 is outstanding again. The authorization was fully captured, so no open payment holds
      // it and a new manual one is authorized below — Medusa's way of collecting again, a new session.
      // An open authorization holding less than the amount asked is not topped up: `capture_`
      // refuses it with what it still holds, and the admin records that first.
      const outstanding = collection.amount.minus(capturedTotal(payments).minus(refundedTotal(payments)))

      if (data.amount.isGreaterThan(outstanding)) {
        throw new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: i18n.t(
            'Payment amount {amount} exceeds the {outstanding} outstanding on payment collection "{id}".',
          ),
          values: { amount: data.amount.toFixed(), outstanding: outstanding.toFixed(), id: collection.id },
        })
      }

      // Only a manual authorization is captured against. Money the admin received in cash says
      // nothing about a card's authorization, and capturing that would charge the card at the
      // gateway as well: the shopper pays twice.
      const open = payments.find(
        (payment) =>
          payment.providerId === MANUAL_PROVIDER_ID &&
          !payment.canceledAt &&
          remainingToCapture(payment).isGreaterThan(0),
      )
      const payment = open ?? (await this.authorizeManualPayment_(collection, outstanding, data.amount, ctx))

      await this.capture_(payment.id, data, ctx)

      return this.retrievePayment(payment.id, ctx)
    })
  }

  async refundPayment(data: CreateRefundDTO, context?: Context): Promise<PaymentDTO> {
    this.logger.debug(`Refunding payment "${data.paymentId}"${data.amount ? ` for amount ${data.amount}` : ''}`)
    return this.withTransaction(context, async (ctx) => {
      const payment = await this.paymentRepository.findByIdOrFail(data.paymentId, undefined, ctx)
      // The same lock captures take, so two refunds at once cannot together return more than was received.
      await this.paymentCollectionRepository.lockForUpdate(payment.paymentCollectionId, ctx)

      if (data.idempotencyKey) {
        const recorded = await this.refundRepository.findOne({ idempotencyKey: data.idempotencyKey }, undefined, ctx)
        if (recorded) return this.retrievePayment(recorded.paymentId, ctx)
      }

      // Can only refund what was captured minus what was already refunded
      const [captures, refunds] = await Promise.all([
        this.captureRepository.find({ paymentId: payment.id }, undefined, ctx),
        this.refundRepository.find({ paymentId: payment.id }, undefined, ctx),
      ])
      const alreadyRefunded = sumAmounts(refunds)
      const refundableAmount = sumAmounts(captures).minus(alreadyRefunded)
      const refundAmount = data.amount ?? refundableAmount

      if (refundAmount.isLessThanOrEqualTo(0)) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('Payment "{id}" has no refundable amount remaining.'),
          values: { id: payment.id },
        })
      }

      if (refundAmount.isGreaterThan(refundableAmount)) {
        throw new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: i18n.t('Refund amount {refundAmount} exceeds refundable amount {refundableAmount}.'),
          values: { refundAmount: refundAmount.toFixed(), refundableAmount: refundableAmount.toFixed() },
        })
      }

      // Keyed off the refund row's id, this would not survive a rollback: the retry after a crash
      // inserts a new row, presents a new key, and Stripe makes a *second* refund. Nothing
      // upstream objects, because the rolled-back row is gone from `alreadyRefunded` too and a
      // partial refund never trips `charge_already_refunded`. So the key is composed from three
      // values that a rollback cannot change — which payment, how much was already refunded
      // before this one, and how much this one is for. Two genuine partial refunds of the same
      // amount still differ, because the second sees the first in `alreadyRefunded`.
      //
      // Not the caller's `idempotencyKey`, even when there is one: that names one workflow run, and
      // an admin pressing Refund again after a gateway failure is a second run with a second key.
      // A run retrying a refund that committed never reaches here — the row lookup above answers it.
      const refundKey = idempotencyKeyFor('refund', payment.id, alreadyRefunded.toFixed(), refundAmount.toFixed())

      await this.refundRepository.create(
        {
          paymentId: payment.id,
          amount: refundAmount,
          refundReasonId: data.refundReasonId ?? null,
          note: data.note ?? null,
          createdBy: data.createdBy ?? null,
          idempotencyKey: data.idempotencyKey ?? null,
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

      return this.retrievePayment(payment.id, ctx)
    })
  }

  /** Voids what the authorization still holds, under the collection's row lock so a capture cannot land on it halfway. */
  async cancelPayment(paymentId: string, context?: Context): Promise<PaymentDTO> {
    this.logger.debug(`Canceling payment "${paymentId}"`)
    return this.withTransaction(context, async (ctx) => {
      const payment = await this.paymentRepository.findByIdOrFail(paymentId, undefined, ctx)
      await this.paymentCollectionRepository.lockForUpdate(payment.paymentCollectionId, ctx)

      if (payment.canceledAt) {
        return this.retrievePayment(payment.id, ctx)
      }

      await this.void_(payment, ctx)
      await this.maybeUpdatePaymentCollection_(payment.paymentCollectionId, ctx)

      return this.retrievePayment(payment.id, ctx)
    })
  }

  /**
   * Voids every authorization on the collection that still holds money, under its row lock, so no
   * capture can land on it halfway through an Order's cancel. A fully captured payment has nothing
   * left to void and is left alone.
   *
   * Refused, with nothing voided, when the collection's captures no longer add up to
   * `capturedAmount`: the caller planned its refund around that figure, and a capture recorded since
   * would otherwise stay on a canceled Order, neither refunded nor voided.
   */
  async cancelPaymentCollection(
    paymentCollectionId: string,
    data: CancelPaymentCollectionDTO,
    context?: Context,
  ): Promise<PaymentCollectionDTO> {
    this.logger.debug(`Canceling payment collection "${paymentCollectionId}"`)
    return this.withTransaction(context, async (ctx) => {
      await this.paymentCollectionRepository.lockForUpdate(paymentCollectionId, ctx)
      const collection = await this.retrievePaymentCollection(paymentCollectionId, undefined, ctx)
      const payments = collection.payments ?? []

      const captured = capturedTotal(payments)
      if (!captured.isEqualTo(data.capturedAmount)) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t(
            'Payment collection "{id}" cannot be canceled: a payment of {amount} was recorded on it meanwhile.',
          ),
          values: { id: collection.id, amount: captured.minus(data.capturedAmount).toFixed() },
        })
      }

      const holding = payments.filter((payment) => !payment.canceledAt && remainingToCapture(payment).isGreaterThan(0))
      await Promise.all(holding.map((payment) => this.void_(payment, ctx)))
      // Marked, not only voided: a payment recorded after this would otherwise open a new manual
      // authorization and capture onto the canceled Order. `capture_` reads the mark under the
      // same lock, so whichever of the two takes the lock first, the other is refused.
      if (!collection.canceledAt) {
        await this.paymentCollectionRepository.update(collection.id, { canceledAt: new Date() }, ctx)
      }
      await this.maybeUpdatePaymentCollection_(collection.id, ctx)

      return this.retrievePaymentCollection(collection.id, undefined, ctx)
    })
  }

  /**
   * Takes the cancel mark off a collection, for an Order cancel that rolled back after the void:
   * the Order is open again and can be paid. What was voided stays voided; a payment recorded
   * after this authorizes anew.
   */
  async reopenPaymentCollection(paymentCollectionId: string, context?: Context): Promise<PaymentCollectionDTO> {
    this.logger.debug(`Reopening payment collection "${paymentCollectionId}"`)
    return this.withTransaction(context, async (ctx) => {
      await this.paymentCollectionRepository.lockForUpdate(paymentCollectionId, ctx)
      await this.paymentCollectionRepository.update(paymentCollectionId, { canceledAt: null }, ctx)
      await this.maybeUpdatePaymentCollection_(paymentCollectionId, ctx)

      return this.retrievePaymentCollection(paymentCollectionId, undefined, ctx)
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
        if (!AppError.isError(error) || error.code !== PaymentErrorCodes.METHOD_UNAVAILABLE) throw error
        this.logger.debug(`Payment method "${methodId}" is not held at provider "${holder.providerId}"`)
      }
    }

    throw new AppError({
      type: ErrorTypes.CONFLICT,
      code: PaymentErrorCodes.METHOD_UNAVAILABLE,
      message: i18n.t('That payment method is no longer available.'),
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

  /**
   * The capture itself, for a caller already holding the collection's lock. Re-reads the payment
   * and its captures under that lock, which is what makes the remaining-amount check hold.
   */
  private async capture_(paymentId: string, data: Omit<CreateCaptureDTO, 'paymentId'>, ctx: Context): Promise<void> {
    // The step that recorded it is running again; the money was taken the first time.
    if (await this.findCaptureByKey_(data.idempotencyKey, ctx)) return

    const payment = await this.retrievePayment(paymentId, ctx)
    // Under the lock the caller holds, so a cancel that took it first is seen here.
    const collection = await this.paymentCollectionRepository.findByIdOrFail(
      payment.paymentCollectionId,
      undefined,
      ctx,
    )

    if (collection.canceledAt) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: i18n.t('Payment collection "{id}" has been canceled: no payment can be recorded on it.'),
        values: { id: collection.id },
      })
    }

    if (payment.canceledAt) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: i18n.t('Payment "{id}" has been canceled and cannot be captured.'),
        values: { id: payment.id },
      })
    }

    // Read from the capture rows rather than `capturedAt`, because the rows are the ledger: they
    // decide both what is taken and whether there is anything left to take.
    const remaining = remainingToCapture(payment)

    // Nothing outstanding means the money is already taken. A gateway redelivering its own
    // completed-charge event lands here, so this has to be a refusal the caller can recognise
    // rather than a second charge.
    if (remaining.isLessThanOrEqualTo(0)) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: i18n.t('Payment "{id}" has already been fully captured.'),
        values: { id: payment.id },
      })
    }

    const amount = data.amount ?? remaining

    if (amount.isLessThanOrEqualTo(0)) {
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: i18n.t('Capture amount must be greater than zero.'),
      })
    }

    if (amount.isGreaterThan(remaining)) {
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: i18n.t('Capture amount {amount} exceeds the {remaining} still authorized on payment "{id}".'),
        values: { amount: amount.toFixed(), remaining: remaining.toFixed(), id: payment.id },
      })
    }

    if (amount.isLessThan(remaining) && !this.paymentProviderService.canCapturePartially(payment.providerId)) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: i18n.t(
          'Payment "{id}" can only be captured in full: its provider cannot take part of an authorization.',
        ),
        values: { id: payment.id },
      })
    }

    const capture = await this.captureRepository.create(
      {
        paymentId: payment.id,
        amount,
        createdBy: data.capturedBy ?? null,
        idempotencyKey: data.idempotencyKey ?? null,
      },
      ctx,
    )

    // Keyed by the caller's key when there is one, because it survives a rollback and the row id
    // does not: a crash between the insert and the gateway's acknowledgement rolls the row back,
    // and its retry inserts a different one. Without a key, the remaining-amount check and the
    // gateway's own refusal of a second full capture are what stop a second charge.
    await this.paymentProviderService.capturePayment(payment.providerId, {
      amount,
      currencyCode: payment.currencyCode,
      data: payment.data ?? undefined,
      context: { idempotencyKey: idempotencyKeyFor('capture', data.idempotencyKey ?? capture.id) },
    })

    if (amount.isEqualTo(remaining)) {
      await this.paymentRepository.update(payment.id, { capturedAt: new Date() }, ctx)
    }

    await this.maybeUpdatePaymentCollection_(payment.paymentCollectionId, ctx)
  }

  /** The void itself, for a caller already holding the collection's lock. */
  private async void_(payment: PaymentDTO, ctx: Context): Promise<void> {
    await this.paymentProviderService.cancelPayment(payment.providerId, {
      data: payment.data ?? undefined,
      context: { idempotencyKey: idempotencyKeyFor('cancel', payment.paymentSessionId) },
    })
    await this.paymentRepository.update(payment.id, { canceledAt: new Date() }, ctx)
  }

  private async findCaptureByKey_(idempotencyKey: string | undefined, ctx: Context) {
    if (!idempotencyKey) return null
    return this.captureRepository.findOne({ idempotencyKey }, undefined, ctx)
  }

  /**
   * Opens and authorizes a manual session for what is outstanding and not already held by another
   * provider's open authorization: the authorization recorded payments capture against.
   *
   * A card authorized and not yet captured can still be captured at the gateway, so the part it
   * holds is spoken for. The manual session takes only the rest, as a collection can hold several
   * sessions, so the two together never authorize more than the total. A payment that does not
   * fit in the rest is refused rather than voiding the card to make room: releasing the shopper's
   * card is a decision of its own, and a refusal leaves nothing done.
   */
  private async authorizeManualPayment_(
    collection: PaymentCollectionDTO,
    outstanding: BigNumber,
    requested: BigNumber,
    ctx: Context,
  ): Promise<PaymentDTO> {
    const held = (collection.payments ?? [])
      .filter((payment) => payment.providerId !== MANUAL_PROVIDER_ID && !payment.canceledAt)
      .reduce((sum, payment) => sum.plus(remainingToCapture(payment)), new BigNumber(0))
    const amount = outstanding.minus(held)

    if (requested.isGreaterThan(amount)) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: i18n.t(
          'Payment amount {amount} cannot be recorded on payment collection "{id}": {held} of it is held by an open authorization at another provider. Capture or cancel that payment first.',
        ),
        values: { amount: requested.toFixed(), held: held.toFixed(), id: collection.id },
      })
    }

    const session = await this.createPaymentSession(
      collection.id,
      { providerId: MANUAL_PROVIDER_ID, amount, currencyCode: collection.currencyCode },
      ctx,
    )
    const authorization = await this.authorizePaymentSession(session.id, ctx)

    // The manual provider authorizes unconditionally, so the other outcomes are unreachable.
    // Refused rather than asserted, because reading `payment` off them would be reading nothing.
    if (authorization.outcome !== 'authorized') {
      throw new AppError({
        type: ErrorTypes.UNEXPECTED_STATE,
        message: i18n.t('The manual payment for collection "{id}" was not authorized.'),
        values: { id: collection.id },
      })
    }
    return authorization.payment
  }

  private async maybeUpdatePaymentCollection_(collectionId: string, context?: Context): Promise<void> {
    const collection = await this.paymentCollectionRepository.findByIdOrFail(collectionId, undefined, context)

    const [sessions, payments] = await Promise.all([
      this.paymentSessionRepository.find({ paymentCollectionId: collectionId }, undefined, context),
      this.paymentRepository.find({ paymentCollectionId: collectionId }, undefined, context),
    ])

    const paymentIds = payments.map((p) => p.id)
    const [captures, refunds] =
      paymentIds.length > 0
        ? await Promise.all([
            this.captureRepository.find({ paymentId: paymentIds }, undefined, context),
            this.refundRepository.find({ paymentId: paymentIds }, undefined, context),
          ])
        : [[], []]

    // A voided payment's session still reads `authorized`; its money is no longer held.
    const canceledSessionIds = new Set(payments.filter((p) => p.canceledAt).map((p) => p.paymentSessionId))
    const authorizedAmount = sumAmounts(
      sessions.filter((session) => session.status === 'authorized' && !canceledSessionIds.has(session.id)),
    )
    const capturedAmount = sumAmounts(captures)
    const refundedAmount = sumAmounts(refunds)

    // Derive status (check most advanced status first). A refund does not move it: the Order's
    // payment status reads `refundedAmount` beside it, as Medusa's aggregation does.
    let status: PaymentCollectionStatus = 'not_paid'
    let completedAt: Date | null = collection.completedAt

    if (capturedAmount.isGreaterThanOrEqualTo(collection.amount)) {
      status = 'completed'
      completedAt = completedAt ?? new Date()
    } else if (capturedAmount.isGreaterThan(0)) {
      status = 'partially_captured'
    } else if (collection.canceledAt) {
      // Only once nothing was captured: money taken keeps the status that reads it, so the Order's
      // payment status still shows what it received and returned.
      status = 'canceled'
    } else if (authorizedAmount.isGreaterThanOrEqualTo(collection.amount)) {
      status = 'authorized'
    } else if (authorizedAmount.isGreaterThan(0)) {
      status = 'partially_authorized'
    } else if (payments.length > 0 && payments.every((p) => p.canceledAt)) {
      status = 'canceled'
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
