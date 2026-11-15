import { BigNumber } from '@core/bignumber.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import paymentDefinitions from '../../payments/definitions.js'
import type * as orderByIdRoutes from '../[id]/route.js'
import orderDefinitions from '../definitions.js'

type Services = Fixtures['service']
type OrderDetail = Awaited<ReturnType<typeof orderByIdRoutes.GET>>['json']['order']

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: [...orderDefinitions, ...paymentDefinitions] })
})

/**
 * An Order for exactly 100, placed by a checkout whose shopper chose manual payment: its one
 * payment collection is authorized for the whole total through the system provider, and nothing
 * has been received yet.
 */
async function orderForAHundred(service: Services) {
  const { order } = await service.create.order(api.container, {
    lineItem: { unitPrice: new BigNumber(70), quantity: 1 },
    shippingMethod: { amount: new BigNumber(30) },
  })
  return order.id
}

/** The admin's order detail, read the way the admin reads it. */
async function detail(orderId: string) {
  const { status, body } = await api.get<{ order: OrderDetail }>(`/admin/orders/${orderId}`)
  if (status !== 200) throw new Error(`GET /admin/orders/${orderId} answered ${status}`)
  return body.order
}

const recordPayment = (orderId: string, amount: string) =>
  api.post<ApiErrorBody>(`/admin/orders/${orderId}/payments`, { amount })

/** What the admin sees: the three numbers and the status they were recorded as. */
const standing = (order: OrderDetail) => ({
  paymentStatus: order.paymentStatus,
  paidTotal: order.totals.paidTotal,
  outstandingTotal: order.totals.outstandingTotal,
})

test.describe('Recording payments on an order', () => {
  test('a deposit, the rest, and a refund — each one an order transaction', async ({ service, expect }) => {
    const orderId = await orderForAHundred(service)
    expect(standing(await detail(orderId))).toEqual({
      paymentStatus: 'authorized',
      paidTotal: '0',
      outstandingTotal: '100',
    })

    const deposit = await recordPayment(orderId, '30')
    expect(deposit.status).toBe(200)

    const afterDeposit = await detail(orderId)
    expect(standing(afterDeposit)).toEqual({
      paymentStatus: 'partially_captured',
      paidTotal: '30',
      outstandingTotal: '70',
    })
    // The detail carries the collection, its one authorization and the capture recorded against it.
    const [collection] = afterDeposit.paymentCollections
    assertDefined(collection)
    expect(collection).toMatchObject({ amount: '100', status: 'partially_captured', capturedAmount: '30' })
    const [payment] = collection.payments ?? []
    assertDefined(payment)
    const [capture] = payment.captures ?? []
    assertDefined(capture)
    expect(afterDeposit.transactions).toEqual([
      expect.objectContaining({ amount: '30', reference: 'capture', referenceId: capture.id }),
    ])

    const tooMuch = await recordPayment(orderId, '70.01')
    expect(tooMuch.status).toBe(400)
    expect(tooMuch.body.message).toBe(`Payment amount 70.01 exceeds the 70 outstanding on order ${orderId}.`)

    expect((await recordPayment(orderId, '70')).status).toBe(200)
    expect(standing(await detail(orderId))).toEqual({
      paymentStatus: 'captured',
      paidTotal: '100',
      outstandingTotal: '0',
    })

    const refundTooMuch = await api.post<ApiErrorBody>(`/admin/payments/${payment.id}/refund`, { amount: '100.01' })
    expect(refundTooMuch.status).toBe(400)

    expect((await api.post(`/admin/payments/${payment.id}/refund`, { amount: '25' })).status).toBe(200)

    const afterRefund = await detail(orderId)
    expect(standing(afterRefund)).toEqual({
      paymentStatus: 'partially_refunded',
      paidTotal: '75',
      outstandingTotal: '25',
    })
    const refund = afterRefund.paymentCollections[0]?.payments?.[0]?.refunds?.[0]
    assertDefined(refund)
    expect(afterRefund.transactions).toHaveLength(3)
    expect(afterRefund.transactions).toContainEqual(
      expect.objectContaining({ amount: '-25', reference: 'refund', referenceId: refund.id }),
    )
  })

  test('canceling with part of the deposit refunded keeps the rest on the books', async ({ service, expect }) => {
    const orderId = await orderForAHundred(service)
    expect((await recordPayment(orderId, '30')).status).toBe(200)

    // More than was received is refused, and the order is still standing afterwards.
    const refused = await api.post<ApiErrorBody>(`/admin/orders/${orderId}/cancel`, { refundAmount: '30.01' })
    expect(refused.status).toBe(400)
    expect((await detail(orderId)).status).toBe('pending')

    const canceled = await api.post(`/admin/orders/${orderId}/cancel`, { refundAmount: '10' })
    expect(canceled.status).toBe(200)

    const after = await detail(orderId)
    expect(after.status).toBe('canceled')
    expect(standing(after)).toEqual({
      paymentStatus: 'partially_refunded',
      paidTotal: '20',
      outstandingTotal: '80',
    })
    // What the authorization still held is voided, so nothing more can be captured against it.
    expect(after.paymentCollections[0]?.payments?.[0]?.canceledAt).not.toBeNull()
    expect((await recordPayment(orderId, '10')).status).toBe(400)
  })

  test('canceling with nothing said refunds everything received', async ({ service, expect }) => {
    const orderId = await orderForAHundred(service)
    expect((await recordPayment(orderId, '30')).status).toBe(200)

    expect((await api.post(`/admin/orders/${orderId}/cancel`)).status).toBe(200)

    const after = await detail(orderId)
    expect(standing(after)).toEqual({
      paymentStatus: 'partially_refunded',
      paidTotal: '0',
      outstandingTotal: '100',
    })
    // Zero because the deposit came back, not because nothing was ever recorded.
    expect(after.transactions.map(({ amount, reference }) => ({ amount, reference }))).toEqual(
      expect.arrayContaining([
        { amount: '30', reference: 'capture' },
        { amount: '-30', reference: 'refund' },
      ]),
    )
  })
})
