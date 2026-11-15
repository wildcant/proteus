import { BigNumber } from '@core/bignumber.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { vi } from 'vitest'
import { addOrderTransactionsStep } from '../../order/steps/add-order-transactions.js'
import { recordOrderPaymentWorkflow } from '../record-order-payment.js'
import { refundPaymentWorkflow } from '../refund-payment.js'
import { refundPaymentsStep } from '../steps/refund-payments.js'

type Services = Fixtures['service']

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/** An Order for exactly 100 whose shopper chose manual payment at checkout. */
async function orderForAHundred(service: Services) {
  const { order } = await service.create.order(container, {
    lineItem: { unitPrice: new BigNumber(70), quantity: 1 },
    shippingMethod: { amount: new BigNumber(30) },
  })
  const link = await service.read.linkRepo(container, 'orderPaymentCollection').findByOrderId(order.id)
  assertDefined(link)
  return { orderId: order.id, paymentCollectionId: link.paymentCollectionId }
}

/**
 * What the engine does when the capture step's Activity is retried after it committed: the same
 * recorded input — the same minted key — reaches the payment module again, and the transaction
 * step is handed the capture it answers with. Replayed by hand because the simple engine never
 * retries, and the parity engine retries only on a failure injected between commit and report.
 */
const replayedCaptureWorkflow = createWorkflow<
  { orderId: string; paymentCollectionId: string; amount: BigNumber; idempotencyKey: string },
  void
>('test-replayed-order-capture', async (ctx, input) => {
  const replayed = await ctx.step('replay-capture', async ({ container: scope }) => {
    const payment = await scope.resolve(Modules.PAYMENT).capturePaymentCollection(input.paymentCollectionId, {
      amount: input.amount,
      idempotencyKey: input.idempotencyKey,
    })
    const capture = payment.captures?.find((row) => row.idempotencyKey === input.idempotencyKey)
    if (!capture) throw new Error('the replay found no capture under its key')
    return [
      {
        orderId: input.orderId,
        amount: capture.amount,
        currencyCode: payment.currencyCode,
        reference: 'capture',
        referenceId: capture.id,
      },
    ]
  })
  await addOrderTransactionsStep(ctx, { transactions: replayed })
})

test.describe('record-order-payment', () => {
  test('records a deposit as one capture and one order transaction', async ({ service, expect }) => {
    const { orderId, paymentCollectionId } = await orderForAHundred(service)

    const recorded = await recordOrderPaymentWorkflow.run({ orderId, amount: new BigNumber(30) })

    expect(recorded.paymentCollectionId).toBe(paymentCollectionId)
    expect(await service.read.orderTransactions(container, orderId)).toEqual([
      expect.objectContaining({ amount: new BigNumber(30), reference: 'capture', referenceId: recorded.captureId }),
    ])
    expect(await service.read.paymentCollection(container, paymentCollectionId)).toMatchObject({
      status: 'partially_captured',
      capturedAmount: new BigNumber(30),
    })
  })

  /** A converted draft holds no collection; its first payment is what gives it one. */
  test('gives an order with no payment collection one for its total', async ({ service, expect }) => {
    const { orderId, paymentCollectionId } = await orderForAHundred(service)
    await container.resolve(ContainerRegistrationKeys.LINK).dismissLinks({ paymentCollectionId: [paymentCollectionId] })

    const recorded = await recordOrderPaymentWorkflow.run({ orderId, amount: new BigNumber(30) })

    expect(recorded.paymentCollectionId).not.toBe(paymentCollectionId)
    const link = await service.read.linkRepo(container, 'orderPaymentCollection').findByOrderId(orderId)
    expect(link?.paymentCollectionId).toBe(recorded.paymentCollectionId)
    expect(await service.read.paymentCollection(container, recorded.paymentCollectionId)).toMatchObject({
      amount: new BigNumber(100),
      capturedAmount: new BigNumber(30),
      status: 'partially_captured',
    })
  })

  /** Two admins recording the first payment at once: each reads "no collection yet" before either writes. */
  test('two first payments at once share one collection and never capture above the total', async ({
    service,
    expect,
  }) => {
    const { orderId, paymentCollectionId } = await orderForAHundred(service)
    await container.resolve(ContainerRegistrationKeys.LINK).dismissLinks({ paymentCollectionId: [paymentCollectionId] })

    // Holds each run at the collection's creation until both have got there, so both have read
    // "no collection yet": the interleaving that otherwise depends on timing.
    const paymentService = container.resolve(Modules.PAYMENT)
    const createPaymentCollection = paymentService.createPaymentCollection.bind(paymentService)
    let arrived = 0
    let releaseBoth: () => void = () => undefined
    const bothArrived = new Promise<void>((resolve) => {
      releaseBoth = resolve
    })
    vi.spyOn(paymentService, 'createPaymentCollection').mockImplementation(async (...args) => {
      arrived += 1
      if (arrived === 2) releaseBoth()
      await bothArrived
      return createPaymentCollection(...args)
    })

    const results = await Promise.allSettled([
      recordOrderPaymentWorkflow.run({ orderId, amount: new BigNumber(60) }),
      recordOrderPaymentWorkflow.run({ orderId, amount: new BigNumber(60) }),
    ])

    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected'])
    const [recorded] = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
    assertDefined(recorded)
    const link = await service.read.linkRepo(container, 'orderPaymentCollection').findByOrderId(orderId)
    expect(link?.paymentCollectionId).toBe(recorded.paymentCollectionId)
    expect((await service.read.paymentCollection(container, recorded.paymentCollectionId)).capturedAmount).toEqual(
      new BigNumber(60),
    )
    const transactions = await service.read.orderTransactions(container, orderId)
    expect(transactions.map((transaction) => transaction.amount.toFixed())).toEqual(['60'])
  })

  /** The workflow is idempotent, so a retryable refusal would have Temporal ask again for an id that is not there. */
  test('refuses an unknown order as final, not as worth retrying', async ({ expect }) => {
    const run = recordOrderPaymentWorkflow.run({ orderId: 'ord_missing', amount: new BigNumber(30) })

    await expect(run).rejects.toThrow(WorkflowTerminalError)
    await expect(run).rejects.toThrow('Order with id "ord_missing" not found')
  })

  test('a retried capture step takes the money once and writes one order transaction', async ({ service, expect }) => {
    const { orderId, paymentCollectionId } = await orderForAHundred(service)
    await recordOrderPaymentWorkflow.run({ orderId, amount: new BigNumber(30) })
    const [capture] =
      (await service.read.paymentCollection(container, paymentCollectionId)).payments?.[0]?.captures ?? []
    assertDefined(capture)
    assertDefined(capture.idempotencyKey)

    await replayedCaptureWorkflow.run({
      orderId,
      paymentCollectionId,
      amount: new BigNumber(30),
      idempotencyKey: capture.idempotencyKey,
    })

    const collection = await service.read.paymentCollection(container, paymentCollectionId)
    expect(collection.capturedAmount).toEqual(new BigNumber(30))
    expect(collection.payments?.flatMap((payment) => payment.captures ?? [])).toHaveLength(1)
    expect(await service.read.orderTransactions(container, orderId)).toHaveLength(1)
  })

  test('a retried refund step returns the money once and writes one order transaction', async ({ service, expect }) => {
    const { orderId, paymentCollectionId } = await orderForAHundred(service)
    await recordOrderPaymentWorkflow.run({ orderId, amount: new BigNumber(30) })
    const [payment] = (await service.read.paymentCollection(container, paymentCollectionId)).payments ?? []
    assertDefined(payment)

    const refunds = [{ paymentId: payment.id, amount: new BigNumber(10), idempotencyKey: 'refund-once' }]
    await createWorkflow<void, void>('test-retried-refund', async (ctx) => {
      await refundPaymentsStep(ctx, { refunds, orderId })
      await refundPaymentsStep(ctx, { refunds, orderId })
    }).run()

    expect((await service.read.paymentCollection(container, paymentCollectionId)).refundedAmount).toEqual(
      new BigNumber(10),
    )
    const transactions = await service.read.orderTransactions(container, orderId)
    expect(transactions.map((transaction) => transaction.amount.toFixed()).sort()).toEqual(['-10', '30'])
  })

  /** Outstanding is the total less the Paid Total, on the Order and on its collection alike. */
  test('what a refund returned can be recorded again', async ({ service, expect }) => {
    const { orderId, paymentCollectionId } = await orderForAHundred(service)
    const paid = await recordOrderPaymentWorkflow.run({ orderId, amount: new BigNumber(100) })
    await refundPaymentWorkflow.run({ paymentId: paid.paymentId, amount: new BigNumber(25) })

    const recollected = await recordOrderPaymentWorkflow.run({ orderId, amount: new BigNumber(25) })

    expect(recollected.paymentCollectionId).toBe(paymentCollectionId)
    const transactions = await service.read.orderTransactions(container, orderId)
    expect(transactions.map((transaction) => transaction.amount.toFixed()).sort()).toEqual(['-25', '100', '25'])
    await expect(recordOrderPaymentWorkflow.run({ orderId, amount: new BigNumber(1) })).rejects.toThrow(
      'exceeds the 0 outstanding on order',
    )
  })

  test('refund-payment refuses more than was received, and records nothing', async ({ service, expect }) => {
    const { orderId, paymentCollectionId } = await orderForAHundred(service)
    await recordOrderPaymentWorkflow.run({ orderId, amount: new BigNumber(30) })
    const [payment] = (await service.read.paymentCollection(container, paymentCollectionId)).payments ?? []
    assertDefined(payment)

    await expect(refundPaymentWorkflow.run({ paymentId: payment.id, amount: new BigNumber(31) })).rejects.toThrow(
      'Refund amount 31 must be more than zero and at most the 30 received.',
    )
    expect(await service.read.orderTransactions(container, orderId)).toHaveLength(1)
    expect((await service.read.paymentCollection(container, paymentCollectionId)).refundedAmount).toBeNull()
  })
})
