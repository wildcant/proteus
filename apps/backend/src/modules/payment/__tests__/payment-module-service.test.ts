import { BigNumber } from '@core/db/bignum.js'
import { ErrorTypes } from '@core/errors/app-error.js'
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
    listPaymentMethods: vi.fn().mockResolvedValue([{ id: 'pm_1', data: { last4: '4242' } }]),
    savePaymentMethod: vi.fn().mockResolvedValue({ id: 'pm_saved_1', data: { last4: '4242' } }),
    deletePaymentMethod: vi.fn().mockResolvedValue({}),
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

test.beforeEach(({ getDb, logger }) => {
  mockProvider = createMockProviderService()
  captureRepository = new CaptureRepository({ getDb, cascadeGraph })
  refundRepository = new RefundRepository({ getDb, cascadeGraph })

  service = new PaymentModuleService({
    paymentCollectionRepository: new PaymentCollectionRepository({ getDb, cascadeGraph }),
    paymentSessionRepository: new PaymentSessionRepository({ getDb, cascadeGraph }),
    paymentRepository: new PaymentRepository({ getDb, cascadeGraph }),
    captureRepository,
    refundRepository,
    refundReasonRepository: new RefundReasonRepository({ getDb, cascadeGraph }),
    accountHolderRepository: new AccountHolderRepository({ getDb, cascadeGraph }),
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

    test('softDeletePaymentSession removes session and calls provider', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())

      await service.softDeletePaymentSession(session.id)

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

    test('capturePayment partial capture', async ({ expect, dto }) => {
      const collection = await service.createPaymentCollection(dto.generate.createPaymentCollection())
      const session = await service.createPaymentSession(collection.id, dto.generate.createPaymentSession())
      const authorized = await service.authorizePaymentSession(session.id)
      assertDefined(authorized)

      const firstCapture = await service.capturePayment({ paymentId: authorized.id, amount: new BigNumber(4000) })

      expect(firstCapture.capturedAt).toBeNull()
      expect(firstCapture.captures).toHaveLength(1)
      assertDefined(firstCapture.captures)
      expect(firstCapture.captures[0]?.amount).toEqual(new BigNumber(4000))

      const secondCapture = await service.capturePayment({ paymentId: authorized.id, amount: new BigNumber(6000) })

      expect(secondCapture.capturedAt).toBeInstanceOf(Date)
      expect(secondCapture.captures).toHaveLength(2)
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
  // PaymentMethods (provider-managed, no DB table)
  // ---------------------------------------------------------------------------

  test.describe('PaymentMethods', () => {
    test('createPaymentMethods', async ({ expect }) => {
      const result = await service.createPaymentMethods([
        { providerId: 'system', data: { token: 'tok_123' }, context: {} },
      ])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ id: 'pm_saved_1', data: { last4: '4242' }, providerId: 'system' })
      expect(mockProvider.savePaymentMethod).toHaveBeenCalledOnce()
    })

    test('listPaymentMethods', async ({ expect }) => {
      const result = await service.listPaymentMethods({ providerId: 'system', context: { customerId: 'cus_1' } })

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ id: 'pm_1', data: { last4: '4242' }, providerId: 'system' })
      expect(mockProvider.listPaymentMethods).toHaveBeenCalledOnce()
    })

    test('deletePaymentMethods', async ({ expect }) => {
      await service.deletePaymentMethods([{ id: 'pm_1', providerId: 'system' }])

      expect(mockProvider.deletePaymentMethod).toHaveBeenCalledOnce()
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
      await service.softDeletePaymentSession(spare.id)
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
