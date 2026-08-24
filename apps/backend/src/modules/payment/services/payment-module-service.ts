import { BigNumber } from '../../../core/db/bignum.js'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { FindConfig } from '../../../core/types/common.js'
import type { Context } from '../../../core/types/context.js'
import type { Logger } from '../../../core/types/logger.js'
import type {
  AccountHolderDTO,
  FilterablePaymentMethodProps,
  FilterablePaymentProviderProps,
  PaymentCollectionDTO,
  PaymentCollectionStatus,
  PaymentDTO,
  PaymentMethodDTO,
  PaymentProviderDTO,
  PaymentSessionDTO,
  RefundReasonDTO,
} from '../../../core/types/payment/common.js'
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
import type { PaymentProviderService } from './payment-provider-service.js'

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
        context: input.context,
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
        .deleteSession(input.providerId, { data: session.data })
        .catch((e) => this.logger.error(e))
      throw error
    }
  }

  async authorizePaymentSession(id: string, context?: Context): Promise<PaymentDTO | null> {
    this.logger.debug(`Authorizing payment session "${id}"`)
    const session = await this.paymentSessionRepository.findByIdOrFail(id, undefined, context)

    // Idempotent — safe to call multiple times
    const payment = await this.paymentRepository.findOne({ paymentSessionId: session.id }, undefined, context)
    if (payment && (payment.capturedAt || session.status === 'authorized')) {
      return this.retrievePaymentWithRelations_(payment.id, context)
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

    // Async providers (e.g. bank redirect) resolve later via webhook
    if (status === 'pending_authorization') return null

    // Provider declined or needs more input — no payment to create
    if (status !== 'authorized' && status !== 'captured') {
      await this.maybeUpdatePaymentCollection_(session.paymentCollectionId, context)
      return null
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
        await this.capturePayment({ paymentId: payment.id, amount: payment.amount }, context)
      }

      await this.maybeUpdatePaymentCollection_(session.paymentCollectionId, context)

      return this.retrievePaymentWithRelations_(payment.id, context)
    } catch (error) {
      await this.paymentProviderService.cancelPayment(session.providerId, { data: session.data })
      throw error
    }
  }

  async softDeletePaymentSession(id: string, context?: Context): Promise<void> {
    const session = await this.paymentSessionRepository.findByIdOrFail(id, undefined, context)

    await this.paymentProviderService.deleteSession(session.providerId, { data: session.data })
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

  async capturePayment(data: CreateCaptureDTO, context?: Context): Promise<PaymentDTO> {
    this.logger.debug(`Capturing payment "${data.paymentId}"${data.amount ? ` for amount ${data.amount}` : ''}`)
    return this.withTransaction(context, async (ctx) => {
      const payment = await this.paymentRepository.findByIdOrFail(data.paymentId, undefined, ctx)

      if (payment.canceledAt) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Payment "${payment.id}" has been canceled and cannot be captured.`,
        })
      }

      // Supports partial captures — default to whatever remains
      const existingCaptures = await this.captureRepository.find({ paymentId: payment.id }, undefined, ctx)
      const alreadyCaptured = existingCaptures.reduce((sum, c) => sum.plus(c.amount), new BigNumber(0))
      const remaining = payment.amount.minus(alreadyCaptured)
      const captureAmount = data.amount ?? remaining

      if (captureAmount.isLessThanOrEqualTo(0)) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Payment "${payment.id}" has already been fully captured.`,
        })
      }

      if (captureAmount.isGreaterThan(remaining)) {
        throw new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: `Capture amount ${captureAmount.toFixed()} exceeds remaining capturable amount ${remaining.toFixed()}.`,
        })
      }

      await this.captureRepository.create(
        {
          paymentId: payment.id,
          amount: captureAmount,
          createdBy: data.capturedBy ?? null,
        },
        ctx,
      )

      await this.paymentProviderService.capturePayment(payment.providerId, {
        data: payment.data ?? undefined,
      })

      // Mark payment as fully captured once all funds are accounted for
      const totalCaptured = alreadyCaptured.plus(captureAmount)
      if (totalCaptured.isGreaterThanOrEqualTo(payment.amount)) {
        await this.paymentRepository.update(payment.id, { capturedAt: new Date() }, ctx)
      }

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
        data: payment.data ?? undefined,
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

  getProviderMeta(providerId: string): { label: string; isTestOnly: boolean } {
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
      context: { email: input.email },
    })

    return this.accountHolderRepository.create(
      {
        providerId: input.providerId,
        externalId: provider?.id ?? input.externalId,
        email: input.email ?? null,
        data: provider?.data ?? input.data ?? {},
        metadata: input.metadata ?? null,
      },
      context,
    )
  }

  async deleteAccountHolder(id: string, context?: Context): Promise<void> {
    const accountHolder = await this.accountHolderRepository.findByIdOrFail(id, undefined, context)

    await this.paymentProviderService.deleteAccountHolder(accountHolder.providerId, {
      data: accountHolder.data,
    })

    await this.accountHolderRepository.softDelete([id], context)
  }

  // ---------------------------------------------------------------------------
  // PaymentMethods (provider-managed, no DB table)
  // ---------------------------------------------------------------------------

  async listPaymentMethods(
    filters: FilterablePaymentMethodProps,
    _config?: FindConfig<PaymentMethodDTO>,
    _context?: Context,
  ): Promise<PaymentMethodDTO[]> {
    const result = await this.paymentProviderService.listPaymentMethods(filters.providerId, {
      context: filters.context,
    })

    if (!result) return []

    return result.map((pm) => ({
      id: pm.id,
      data: pm.data ?? {},
      providerId: filters.providerId,
    }))
  }

  async createPaymentMethods(data: CreatePaymentMethodDTO[], _context?: Context): Promise<PaymentMethodDTO[]> {
    const results = await Promise.all(
      data.map(async (item) => {
        const saved = await this.paymentProviderService.savePaymentMethod(item.providerId, {
          data: item.data,
          context: item.context,
        })
        if (!saved) return null
        return { id: saved.id, data: saved.data ?? {}, providerId: item.providerId }
      }),
    )
    return results.filter((r): r is PaymentMethodDTO => r !== null)
  }

  async deletePaymentMethods(data: DeletePaymentMethodDTO[], _context?: Context): Promise<void> {
    await Promise.all(
      data.map((item) =>
        this.paymentProviderService.deletePaymentMethod(item.providerId, {
          data: { id: item.id, ...item.data },
          context: item.context,
        }),
      ),
    )
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
