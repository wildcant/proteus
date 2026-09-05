import { BigNumber } from '@core/bignumber.js'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { Fixtures } from '@tests/setup/test-extend.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { vi } from 'vitest'
import { buildCascadeGraph } from '../../../core/db/cascade-graph.js'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import * as models from '../models/index.js'
import {
  AccountHolderRepository,
  CaptureRepository,
  PaymentCollectionRepository,
  PaymentRepository,
  PaymentSessionRepository,
  RefundReasonRepository,
  RefundRepository,
} from '../repositories/index.js'
import { PaymentModuleService } from '../services/payment-module-service.js'
import type { PaymentProviderService } from '../services/payment-provider-service.js'

const cascadeGraph = buildCascadeGraph(models)

/** Two fixed instants, so "most recent" is a fact about the data and not about the clock. */
const OLDER = new Date('2026-01-01T00:00:00Z')
const NEWER = new Date('2026-06-01T00:00:00Z')

function createMockProviderService() {
  return {
    createSession: vi.fn().mockResolvedValue({
      id: 'ext_session_1',
      data: { externalId: 'ext_session_1' },
      status: 'pending',
    }),
    authorizePayment: vi.fn().mockResolvedValue({
      status: 'authorized',
      data: { externalId: 'ext_session_1' },
    }),
    capturePayment: vi.fn().mockResolvedValue({ data: {} }),
    cancelPayment: vi.fn().mockResolvedValue({ data: {} }),
    deleteSession: vi.fn().mockResolvedValue({ data: {} }),
    refundPayment: vi.fn().mockResolvedValue({ data: {} }),
    createAccountHolder: vi.fn().mockResolvedValue({ id: 'acct_ext_1', data: {} }),
    deleteAccountHolder: vi.fn().mockResolvedValue({ data: {} }),
    listPaymentMethods: vi.fn().mockResolvedValue([]),
    savePaymentMethod: vi.fn().mockResolvedValue({ id: 'pm_saved_1', data: { last4: '4242' } }),
    deletePaymentMethod: vi.fn().mockResolvedValue({}),
    setDefaultPaymentMethod: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue([]),
    getWebhookActionAndData: vi.fn().mockResolvedValue({ action: 'authorized' }),
  }
}

let service: PaymentModuleService
let mockProvider: ReturnType<typeof createMockProviderService>
/** Captures and refunds are only ever read as part of a payment, and a hidden payment cannot be
 *  retrieved — so once the cascade reaches them there is no service-level read left to observe
 *  them through. These two are how the second hop is asserted at all. */
let captureRepository: CaptureRepository
let refundRepository: RefundRepository
/** Held so the concurrency tests can force the interleave a shared database client prevents. */
let accountHolderRepository: AccountHolderRepository

test.beforeEach(({ getDb, logger }) => {
  mockProvider = createMockProviderService()
  captureRepository = new CaptureRepository({ getDb, cascadeGraph })
  refundRepository = new RefundRepository({ getDb, cascadeGraph })
  accountHolderRepository = new AccountHolderRepository({ getDb, cascadeGraph })

  service = new PaymentModuleService({
    paymentCollectionRepository: new PaymentCollectionRepository({ getDb, cascadeGraph }),
    paymentSessionRepository: new PaymentSessionRepository({ getDb, cascadeGraph }),
    paymentRepository: new PaymentRepository({ getDb, cascadeGraph }),
    captureRepository,
    refundRepository,
    refundReasonRepository: new RefundReasonRepository({ getDb, cascadeGraph }),
    accountHolderRepository,
    paymentProviderService: mockProvider as unknown as PaymentProviderService,
    withTransaction: createWithTransaction(getDb),
    logger,
  })
})

test.describe('PaymentModuleService', () => {
  // ---------------------------------------------------------------------------
  // PaymentCollection CRUD
  // ---------------------------------------------------------------------------

  test.describe('PaymentCollection CRUD', () => {
    test('createPaymentCollections', async ({ expect, dto }) => {
      const input = [
        dto.generate.createPaymentCollection(),
        dto.generate.createPaymentCollection({ amount: new BigNumber(5000) }),
      ]

      const result = await service.createPaymentCollections(input)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ amount: new BigNumber(10000), currencyCode: 'usd', status: 'not_paid' })
      expect(result[1]).toMatchObject({ amount: new BigNumber(5000), currencyCode: 'usd', status: 'not_paid' })
      expect(result[0]?.id).toBeDefined()
      expect(result[0]?.createdAt).toBeInstanceOf(Date)
    })

    test('retrievePaymentCollection', async ({ expect, dto }) => {
      const created = await service.createPaymentCollection(dto.generate.createPaymentCollection())

      const result = await service.retrievePaymentCollection(created.id)

      expect(result).toMatchObject({ id: created.id, amount: new BigNumber(10000), status: 'not_paid' })
    })

    test('updatePaymentCollections', async ({ expect, dto }) => {
      const created = await service.createPaymentCollection(dto.generate.createPaymentCollection())

      const updated = await service.updatePaymentCollection(created.id, { amount: new BigNumber(20000) })

      expect(updated.amount).toEqual(new BigNumber(20000))
      expect(updated.id).toBe(created.id)
    })

    test('softDeletePaymentCollections', async ({ expect, dto }) => {
      const created = await service.createPaymentCollection(dto.generate.createPaymentCollection())

      await service.softDeletePaymentCollections([created.id])

      const error = await service.retrievePaymentCollection(created.id).catch((e) => e)
      expect(error.type).toBe(ErrorTypes.NOT_FOUND)
    })

    test('softDeletePaymentCollections and restorePaymentCollections', async ({ expect, dto }) => {
      const created = await service.createPaymentCollection(dto.generate.createPaymentCollection())

      await service.softDeletePaymentCollections([created.id])
      const error = await service.retrievePaymentCollection(created.id).catch((e) => e)
      expect(error.type).toBe(ErrorTypes.NOT_FOUND)

      await service.restorePaymentCollections([created.id])
      const restored = await service.retrievePaymentCollection(created.id)
      expect(restored.id).toBe(created.id)
    })
  })

  // ---------------------------------------------------------------------------
  // PaymentSession lifecycle
  // ---------------------------------------------------------------------------

  test.describe('PaymentSession lifecycle', () => {
    test('createPaymentSession creates session and calls provider', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())

      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())

      expect(session.id).toBeDefined()
      expect(session.paymentCollectionId).toBe(collection.id)
      expect(session.providerId).toBe('system')
      expect(session.amount).toEqual(new BigNumber(10000))
      expect(session.status).toBe('pending')
      expect(session.data).toEqual({ externalId: 'ext_session_1' })
      expect(mockProvider.createSession).toHaveBeenCalledOnce()
    })

    test('createPaymentSession defaults currencyCode from collection', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(
        dto.generate.createPaymentCollection({ currencyCode: 'eur' }),
      )

      const session = await service.createPaymentSession(
        collection.id,
        dto.generate.createPaymentSession({ amount: new BigNumber(5000) }),
      )

      expect(session.currencyCode).toBe('eur')
    })

    test('authorizePaymentSession creates payment', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())

      const payment = await service.authorizePaymentSession(session.id)
      assertDefined(payment)

      expect(payment.id).toBeDefined()
      expect(payment.paymentCollectionId).toBe(collection.id)
      expect(payment.paymentSessionId).toBe(session.id)
      expect(payment.amount).toEqual(new BigNumber(10000))
      expect(payment.captures).toEqual([])
      expect(payment.refunds).toEqual([])
      expect(mockProvider.authorizePayment).toHaveBeenCalledOnce()
    })

    test('authorizePaymentSession is idempotent', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())
      const firstPayment = await service.authorizePaymentSession(session.id)
      assertDefined(firstPayment)

      const secondPayment = await service.authorizePaymentSession(session.id)
      assertDefined(secondPayment)

      expect(secondPayment.id).toBe(firstPayment.id)
      // Provider should only be called once — second call returns early
      expect(mockProvider.authorizePayment).toHaveBeenCalledOnce()
    })

    test('authorizePaymentSession returns null for async providers', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())

      mockProvider.authorizePayment.mockResolvedValueOnce({
        status: 'pending_authorization',
        data: session.data,
      })

      const payment = await service.authorizePaymentSession(session.id)

      expect(payment).toBeNull()
    })

    test('deletePaymentSession removes session and calls provider', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())

      await service.deletePaymentSession(session.id)

      expect(mockProvider.deleteSession).toHaveBeenCalledOnce()
      // Collection should revert to not_paid (no sessions left)
      const updated = await service.retrievePaymentCollection(collection.id)
      expect(updated.status).toBe('not_paid')
    })
  })

  // ---------------------------------------------------------------------------
  // Payment lifecycle
  // ---------------------------------------------------------------------------

  test.describe('Payment lifecycle', () => {
    test('capturePayment full capture', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())
      const authorized = await service.authorizePaymentSession(session.id)
      assertDefined(authorized)

      const captured = await service.capturePayment({ paymentId: authorized.id })

      expect(captured.capturedAt).toBeInstanceOf(Date)
      expect(captured.captures).toHaveLength(1)
      assertDefined(captured.captures)
      expect(captured.captures[0]?.amount).toEqual(new BigNumber(10000))
    })

    /**
     * Replaces a partial-capture test. Partial capture is gone — see *Partial capture* in the
     * spec's Out of Scope — so its premise no longer exists: there is no state in which a payment
     * is captured for part of its amount. What is worth pinning instead is the refusal that
     * replaces it, because the webhook route's acknowledgement of a redelivered event depends on
     * a second capture being refused rather than taking the money again.
     */
    test('capturePayment refuses a second capture', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())
      const authorized = await service.authorizePaymentSession(session.id)
      assertDefined(authorized)
      await service.capturePayment({ paymentId: authorized.id })

      await expect(service.capturePayment({ paymentId: authorized.id })).rejects.toMatchObject({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Payment "${authorized.id}" has already been fully captured.`,
      })

      // The gateway was asked once and the ledger holds one row for the whole authorization.
      expect(mockProvider.capturePayment).toHaveBeenCalledOnce()
      const payment = await service.retrievePayment(authorized.id)
      expect(payment.captures).toHaveLength(1)
      assertDefined(payment.captures)
      expect(payment.captures[0]?.amount).toEqual(new BigNumber(10000))
    })

    test('refundPayment full refund', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())
      const authorized = await service.authorizePaymentSession(session.id)
      assertDefined(authorized)
      await service.capturePayment({ paymentId: authorized.id })

      const refunded = await service.refundPayment({ paymentId: authorized.id })

      expect(refunded.refunds).toHaveLength(1)
      assertDefined(refunded.refunds)
      expect(refunded.refunds[0]?.amount).toEqual(new BigNumber(10000))
      expect(mockProvider.refundPayment).toHaveBeenCalledOnce()
    })

    test('refundPayment partial refund', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())
      const authorized = await service.authorizePaymentSession(session.id)
      assertDefined(authorized)
      await service.capturePayment({ paymentId: authorized.id })

      const first = await service.refundPayment({ paymentId: authorized.id, amount: new BigNumber(3000) })
      expect(first.refunds).toHaveLength(1)
      assertDefined(first.refunds)
      expect(first.refunds[0]?.amount).toEqual(new BigNumber(3000))

      const second = await service.refundPayment({ paymentId: authorized.id, amount: new BigNumber(7000) })
      expect(second.refunds).toHaveLength(2)
    })

    test('cancelPayment', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())
      const authorized = await service.authorizePaymentSession(session.id)
      assertDefined(authorized)

      const canceled = await service.cancelPayment(authorized.id)

      expect(canceled.canceledAt).toBeInstanceOf(Date)
      expect(mockProvider.cancelPayment).toHaveBeenCalledOnce()
    })

    test('cancelPayment is idempotent', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())
      const authorized = await service.authorizePaymentSession(session.id)
      assertDefined(authorized)

      const first = await service.cancelPayment(authorized.id)
      const second = await service.cancelPayment(authorized.id)

      expect(second.canceledAt).toEqual(first.canceledAt)
      // Provider should only be called once — second call returns early
      expect(mockProvider.cancelPayment).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // Collection status transitions
  // ---------------------------------------------------------------------------

  test.describe('collection status transitions', () => {
    test('full lifecycle: not_paid → awaiting → authorized → completed', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
      expect((await service.retrievePaymentCollection(collection.id)).status).toBe('not_paid')

      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())
      expect((await service.retrievePaymentCollection(collection.id)).status).toBe('awaiting')

      const payment = await service.authorizePaymentSession(session.id)
      assertDefined(payment)
      const afterAuth = await service.retrievePaymentCollection(collection.id)
      expect(afterAuth.status).toBe('authorized')
      expect(afterAuth.authorizedAmount).toEqual(new BigNumber(10000))

      await service.capturePayment({ paymentId: payment.id })
      const afterCapture = await service.retrievePaymentCollection(collection.id)
      expect(afterCapture.status).toBe('completed')
      expect(afterCapture.capturedAmount).toEqual(new BigNumber(10000))
      expect(afterCapture.completedAt).toBeInstanceOf(Date)
    })

    /**
     * The retry path. Every Place order press opens a session, so without this a shopper who is
     * declined and reaches for a second card leaves two — two intents at the gateway, one of them
     * confirmed, and cart completion authorizing whichever row came back first.
     */
    test.describe('replacePaymentSession', () => {
      test('abandons the previous attempt instead of adding to it', async ({ expect, dto }) => {
        const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
        const first = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())

        const second = await service.replacePaymentSession(collection.id, dto.generate.createPaymentSession())

        const after = await service.retrievePaymentCollection(collection.id)
        expect(after.paymentSessions?.map((session) => session.id)).toEqual([second.id])
        expect(first.id).not.toBe(second.id)
      })

      test('cancels the abandoned attempt at the gateway rather than forgetting it', async ({ expect, dto }) => {
        const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
        await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())

        await service.replacePaymentSession(collection.id, dto.generate.createPaymentSession())

        // A forgotten session is an authorization left standing against the shopper's card.
        expect(mockProvider.deleteSession).toHaveBeenCalledTimes(1)
      })

      test('leaves no authorization standing when a shopper tries three cards', async ({ expect, dto }) => {
        const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())

        await service.replacePaymentSession(collection.id, dto.generate.createPaymentSession())
        await service.replacePaymentSession(collection.id, dto.generate.createPaymentSession())
        const third = await service.replacePaymentSession(collection.id, dto.generate.createPaymentSession())

        const after = await service.retrievePaymentCollection(collection.id)
        expect(after.paymentSessions?.map((session) => session.id)).toEqual([third.id])
        expect(mockProvider.deleteSession).toHaveBeenCalledTimes(2)
      })

      test('will not abandon a session that has become money', async ({ expect, dto }) => {
        // The guard on the status set. An authorized session is a claim on the shopper's funds
        // that the collection's own totals are already accounting for; cancelling it quietly
        // would leave the ledger describing money that no longer exists.
        const collection = await service.createPaymentCollection(
          dto.generate.createPaymentCollection({ amount: new BigNumber(20000) }),
        )
        const authorized = await service.createPaymentSession(
          collection.id,
          dto.generate.createPaymentSession({ amount: new BigNumber(10000) }),
        )
        await service.authorizePaymentSession(authorized.id)

        const opened = await service.replacePaymentSession(
          collection.id,
          dto.generate.createPaymentSession({ amount: new BigNumber(10000) }),
        )

        const after = await service.retrievePaymentCollection(collection.id)
        expect(after.paymentSessions?.map((session) => session.id).sort()).toEqual([authorized.id, opened.id].sort())
        expect(mockProvider.deleteSession).not.toHaveBeenCalled()
      })

      test('refuses to open a new attempt when the old one cannot be cancelled', async ({ expect, dto }) => {
        // Opening a second attempt while the first may have taken money is worse than refusing:
        // the shopper sees the failure and can press again, and the cancel carries a stable
        // idempotency key, so the retry is the same operation rather than a new one.
        const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
        const first = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())
        mockProvider.deleteSession.mockRejectedValueOnce(new Error('gateway refused the cancellation'))

        await expect(service.replacePaymentSession(collection.id, dto.generate.createPaymentSession())).rejects.toThrow(
          /gateway refused the cancellation/,
        )

        const after = await service.retrievePaymentCollection(collection.id)
        expect(after.paymentSessions?.map((session) => session.id)).toEqual([first.id])
      })
    })

    test('partial authorization sets partially_authorized', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(
        dto.generate.createPaymentCollection({ amount: new BigNumber(20000) }),
      )

      await service.createPaymentSession(
        collection.id,
        dto.generate.createPaymentSession({ amount: new BigNumber(10000) }),
      )
      // Create a second session for the remaining half
      const session2 = await service.createPaymentSession(
        collection.id,
        dto.generate.createPaymentSession({ amount: new BigNumber(10000) }),
      )

      // Authorize only the second session (10000 of 20000)
      await service.authorizePaymentSession(session2.id)

      const afterPartialAuth = await service.retrievePaymentCollection(collection.id)
      expect(afterPartialAuth.status).toBe('partially_authorized')
      expect(afterPartialAuth.authorizedAmount).toEqual(new BigNumber(10000))
    })
  })

  // ---------------------------------------------------------------------------
  // RefundReason CRUD
  // ---------------------------------------------------------------------------

  test.describe('RefundReason CRUD', () => {
    test('createRefundReasons and listRefundReasons', async ({ expect, dto }) => {
      await service.createRefundReasons([
        dto.generate.createRefundReason(),
        dto.generate.createRefundReason({ label: 'Wrong item', code: 'wrong_item' }),
      ])

      const result = await service.listRefundReasons()

      expect(result).toHaveLength(2)
      expect(result[0]?.id).toBeDefined()
      expect(result.map((r) => r.code)).toContain('defective')
      expect(result.map((r) => r.code)).toContain('wrong_item')
    })

    test('updateRefundReason', async ({ expect, dto }) => {
      const created = await service.createRefundReason(dto.generate.createRefundReason())

      const updated = await service.updateRefundReason(created.id, { label: 'Updated label' })

      expect(updated.label).toBe('Updated label')
      expect(updated.code).toBe('defective')
    })

    test('softDeleteRefundReasons', async ({ expect, dto }) => {
      const created = await service.createRefundReason(dto.generate.createRefundReason())

      await service.softDeleteRefundReasons([created.id])

      const result = await service.listRefundReasons()
      expect(result).toHaveLength(0)
    })

    test('softDeleteRefundReasons and restoreRefundReasons', async ({ expect, dto }) => {
      const created = await service.createRefundReason(dto.generate.createRefundReason())

      await service.softDeleteRefundReasons([created.id])
      expect(await service.listRefundReasons()).toHaveLength(0)

      await service.restoreRefundReasons([created.id])
      expect(await service.listRefundReasons()).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------------------
  // AccountHolder
  // ---------------------------------------------------------------------------

  test.describe('AccountHolder', () => {
    test('createAccountHolder', async ({ expect, dto }) => {
      const input = dto.generate.createAccountHolder()

      const result = await service.createAccountHolder(input)

      expect(result.id).toBeDefined()
      expect(result.providerId).toBe('system')
      expect(result.externalId).toBe('acct_ext_1')
      expect(mockProvider.createAccountHolder).toHaveBeenCalledOnce()
    })

    test('deleteAccountHolder', async ({ expect, dto }) => {
      const created = await service.createAccountHolder(dto.generate.createAccountHolder())

      await service.deleteAccountHolder(created.id)

      expect(mockProvider.deleteAccountHolder).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // The wallet (provider-managed, no DB table)
  // ---------------------------------------------------------------------------

  test.describe('The wallet', () => {
    /** A customer id per test: the account holder table is unique on (provider, customer). */
    const customerId = () => `cus_${Math.random().toString(36).slice(2)}`

    test("lists the customer's methods, default first and then most recent", async ({ expect }) => {
      const customer = customerId()
      mockProvider.list.mockResolvedValue([{ id: 'system', isEnabled: true }])
      mockProvider.listPaymentMethods.mockResolvedValue([
        { id: 'pm_old', brand: 'visa', last4: '1111', expMonth: 1, expYear: 2030, isDefault: false, createdAt: OLDER },
        { id: 'pm_new', brand: 'visa', last4: '2222', expMonth: 1, expYear: 2030, isDefault: false, createdAt: NEWER },
        {
          id: 'pm_default',
          brand: 'amex',
          last4: '3333',
          expMonth: 1,
          expYear: 2030,
          isDefault: true,
          createdAt: OLDER,
        },
      ])
      await service.ensureAccountHolders({ customerId: customer })

      const result = await service.listSavedMethods(customer)

      // The default leads even though it is the oldest — otherwise the two surfaces that render
      // this list would each have to decide, and could disagree.
      expect(result.map((method) => method.id)).toEqual(['pm_default', 'pm_new', 'pm_old'])
    })

    test('lists nothing for a customer with no account holder, without asking a gateway', async ({ expect }) => {
      const result = await service.listSavedMethods(customerId())

      expect(result).toEqual([])
      expect(mockProvider.listPaymentMethods).not.toHaveBeenCalled()
    })

    test('detaches through the provider holding the account', async ({ expect }) => {
      const customer = customerId()
      mockProvider.list.mockResolvedValue([{ id: 'system', isEnabled: true }])
      await service.ensureAccountHolders({ customerId: customer })

      await service.deleteSavedMethod(customer, 'pm_1')

      expect(mockProvider.deletePaymentMethod).toHaveBeenCalledOnce()
    })

    test('answers payment_method_unavailable when no provider holds the method', async ({ expect }) => {
      const customer = customerId()
      mockProvider.list.mockResolvedValue([{ id: 'system', isEnabled: true }])
      await service.ensureAccountHolders({ customerId: customer })
      mockProvider.deletePaymentMethod.mockRejectedValue(
        new AppError({
          type: ErrorTypes.CONFLICT,
          code: 'payment_method_unavailable',
          message: 'That payment method is no longer available.',
        }),
      )

      await expect(service.deleteSavedMethod(customer, 'pm_stranger')).rejects.toMatchObject({
        type: ErrorTypes.CONFLICT,
        code: 'payment_method_unavailable',
      })
    })

    test('a provider without setDefaultPaymentMethod needs no stub and does not break', async ({ expect }) => {
      const customer = customerId()
      mockProvider.list.mockResolvedValue([{ id: 'system', isEnabled: true }])
      await service.ensureAccountHolders({ customerId: customer })
      // What `PaymentProviderService` answers for a provider that does not implement it at all.
      mockProvider.setDefaultPaymentMethod.mockResolvedValue(undefined)

      // The call is refused rather than throwing a TypeError, and the wallet's other operations
      // are unaffected — which is the whole promise of the operation being optional.
      await expect(service.setDefaultSavedMethod(customer, 'pm_1')).rejects.toMatchObject({
        code: 'payment_method_unavailable',
      })
      await expect(service.listSavedMethods(customer)).resolves.toBeDefined()
    })
  })

  // ---------------------------------------------------------------------------
  // Account holders
  // ---------------------------------------------------------------------------

  test.describe('ensureAccountHolders', () => {
    const customerId = () => `cus_${Math.random().toString(36).slice(2)}`

    test('creates one on first need and reuses it on the next checkout', async ({ expect }) => {
      const customer = customerId()
      mockProvider.list.mockResolvedValue([{ id: 'system', isEnabled: true }])

      const first = await service.ensureAccountHolders({ customerId: customer, email: 'ada@example.com' })
      const second = await service.ensureAccountHolders({ customerId: customer, email: 'ada@example.com' })

      expect(first).toHaveLength(1)
      expect(second.map((holder) => holder.id)).toEqual(first.map((holder) => holder.id))
      expect(mockProvider.createAccountHolder).toHaveBeenCalledOnce()
    })

    /**
     * Both callers see an empty wallet, which is what "at the same moment" means and what timing
     * alone cannot produce here.
     *
     * `Promise.all` over two `ensureAccountHolders` looks like a race and is not one: the two
     * calls share a database client, so the first INSERT commits before the second SELECT is
     * issued and the second simply finds the row. Stubbing the lookup is the only way to reach
     * the interleave the criterion names — and the recovery branch it exists to protect.
     *
     * Two calls stubbed, one per caller. Everything after them, including the recovery's own
     * read-back, goes to the real database, so the duplicate is a real unique violation and the
     * winner is a real row.
     */
    function bothSeeAnEmptyWallet() {
      vi.spyOn(accountHolderRepository, 'find').mockResolvedValueOnce([]).mockResolvedValueOnce([])
    }

    test('two checkouts at the same moment leave one, when the gateway replays its own id', async ({ expect }) => {
      const customer = customerId()
      mockProvider.list.mockResolvedValue([{ id: 'system', isEnabled: true }])
      // What Stripe does with a replayed idempotency key: both callers are handed the same
      // Customer. The loser's insert therefore collides on (provider, external) first — the
      // index that has nothing to do with the customer, and the order a real race produces.
      bothSeeAnEmptyWallet()

      const [first, second] = await Promise.all([
        service.ensureAccountHolders({ customerId: customer }),
        service.ensureAccountHolders({ customerId: customer }),
      ])

      // The loser read the winner's row rather than failing the shopper's checkout.
      expect(first[0]?.id).toBeDefined()
      expect(first[0]?.id).toBe(second[0]?.id)
      expect(await service.listAccountHolders({ customerId: customer })).toHaveLength(1)
    })

    test('two checkouts at the same moment leave one, when the gateway hands out two ids', async ({ expect }) => {
      const customer = customerId()
      mockProvider.list.mockResolvedValue([{ id: 'system', isEnabled: true }])
      // A gateway that does not replay — or a key that has expired at it. The external ids now
      // differ, so (provider, external) cannot collide and (provider, customer) is the index that
      // refuses the loser. The read-back has to find the winner under this order too.
      mockProvider.createAccountHolder
        .mockResolvedValueOnce({ id: 'acct_ext_first', data: {} })
        .mockResolvedValueOnce({ id: 'acct_ext_second', data: {} })
      bothSeeAnEmptyWallet()

      const [first, second] = await Promise.all([
        service.ensureAccountHolders({ customerId: customer }),
        service.ensureAccountHolders({ customerId: customer }),
      ])

      expect(first[0]?.id).toBeDefined()
      expect(first[0]?.id).toBe(second[0]?.id)
      const surviving = await service.listAccountHolders({ customerId: customer })
      expect(surviving).toHaveLength(1)
      // Whichever won, the row both callers hold is the row that exists.
      expect(surviving[0]?.id).toBe(first[0]?.id)
    })

    test('creates nothing for a provider with no account-holder concept', async ({ expect }) => {
      const customer = customerId()
      mockProvider.list.mockResolvedValue([{ id: 'system', isEnabled: true }])
      mockProvider.createAccountHolder.mockResolvedValue(undefined)

      const holders = await service.ensureAccountHolders({ customerId: customer })

      expect(holders).toEqual([])
      expect(await service.listAccountHolders({ customerId: customer })).toEqual([])
    })
  })

  // ---------------------------------------------------------------------------
  // Webhooks
  // ---------------------------------------------------------------------------

  test.describe('Webhooks', () => {
    test('getWebhookActionAndData delegates to provider', async ({ expect }) => {
      const result = await service.getWebhookActionAndData({
        provider: 'system',
        payload: { data: {}, rawData: '', headers: {} },
      })

      expect(result.action).toBe('authorized')
      expect(mockProvider.getWebhookActionAndData).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // Providers
  // ---------------------------------------------------------------------------

  test.describe('Providers', () => {
    test('listPaymentProviders delegates to provider service', async ({ expect }) => {
      mockProvider.list.mockResolvedValueOnce([{ id: 'system', isEnabled: true }])

      const result = await service.listPaymentProviders()

      expect(result).toEqual([{ id: 'system', isEnabled: true }])
    })
  })

  test.describe('Cascade delete', () => {
    /** A collection carrying one of everything the cascade has to reach. */
    const paidCollection = async (dto: Fixtures['dto']) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())
      const payment = await service.authorizePaymentSession(session.id)
      assertDefined(payment)
      await service.capturePayment({ paymentId: payment.id })
      await service.refundPayment({ paymentId: payment.id, amount: new BigNumber(4000) })

      return { collection, session, payment }
    }

    test('softDeletePaymentCollections — hides every table the collection owns', async ({ expect, dto }) => {
      const { collection, payment } = await paidCollection(dto)
      expect(await captureRepository.find({ paymentId: payment.id })).toHaveLength(1)
      expect(await refundRepository.find({ paymentId: payment.id })).toHaveLength(1)

      await service.softDeletePaymentCollections([collection.id])

      // `withDeleted` gets past the hidden parent; its children are still read live, so empty
      // arrays are the cascade having reached the first hop.
      const hidden = await service.retrievePaymentCollection(collection.id, { withDeleted: true })
      expect(hidden.paymentSessions).toHaveLength(0)
      expect(hidden.payments).toHaveLength(0)

      // A hop further down. Captures and refunds are only readable through a payment, and that
      // payment is now hidden, so the repositories are the only thing left that can see them.
      expect(await captureRepository.find({ paymentId: payment.id })).toHaveLength(0)
      expect(await refundRepository.find({ paymentId: payment.id })).toHaveLength(0)
    })

    test('restorePaymentCollections — brings back exactly the matching event', async ({ expect, dto }) => {
      const { collection, payment } = await paidCollection(dto)
      const spare = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())

      // Deleted on its own, so it carries its own timestamp and was never part of the event below.
      await service.deletePaymentSession(spare.id)
      await service.softDeletePaymentCollections([collection.id])
      await service.restorePaymentCollections([collection.id])

      const restored = await service.retrievePaymentCollection(collection.id)
      expect(restored.payments).toHaveLength(1)
      expect(await captureRepository.find({ paymentId: payment.id })).toHaveLength(1)
      expect(await refundRepository.find({ paymentId: payment.id })).toHaveLength(1)

      // The session the cascade hid comes back; the one hidden beforehand stays where it was.
      expect(restored.paymentSessions).toHaveLength(1)
      expect(restored.paymentSessions?.map((session) => session.id)).not.toContain(spare.id)
    })
  })
})
