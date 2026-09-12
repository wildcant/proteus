import { BigNumber } from '@core/bignumber.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import type * as markAsPaidRoutes from '../[id]/mark-as-paid/route.js'
import paymentCollectionDefinitions from '../definitions.js'

type Service = Fixtures['service']

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({
    definitions: paymentCollectionDefinitions,
    matchers: ['/admin/payment-collections/:id/mark-as-paid'],
  })
})

const markAsPaid = (paymentCollectionId: string) =>
  api.post<typeof markAsPaidRoutes.PostOutput>(`/admin/payment-collections/${paymentCollectionId}/mark-as-paid`)

/** A collection owing money and holding nothing yet — an order awaiting an offline payment. */
const unpaidCollection = async (service: Service) => {
  const cart = await service.create.cart(api.container, { currencyCode: 'usd' })
  const { paymentCollection } = await service.create.paymentSessionForCart(api.container, {
    cartId: cart.id,
    amount: new BigNumber(2500),
  })

  return paymentCollection
}

test.describe('POST /admin/payment-collections/:id/mark-as-paid', () => {
  test('settles the collection with a captured payment', async ({ service, expect }) => {
    const collection = await unpaidCollection(service)

    const { status, body } = await markAsPaid(collection.id)

    expect(status).toBe(200)
    expect(body.paymentCollection.status).toBe('completed')

    const settled = await service.read.paymentCollection(api.container, collection.id)
    const payment = settled.payments?.[0]
    expect(payment?.capturedAt).not.toBeNull()
    expect(payment?.captures?.map((capture) => capture.amount.toFixed())).toEqual(['2500'])
  })

  /**
   * The reason the three mutations share a transaction rather than a step each.
   *
   * A capture that fails after the session and the payment are written would leave the collection
   * holding an authorized payment nobody captured: unpaid on the order, while the money is gone.
   * Nothing is coming to resolve it either — no gateway was ever charged, so there is no webhook.
   * Postgres unwinding the whole method is what makes that state unreachable, and this is the test
   * that proves the unwinding actually happens rather than being asserted in a comment.
   */
  test('leaves nothing behind when the capture fails', async ({ service, expect }) => {
    const collection = await unpaidCollection(service)
    const sessionsBefore = (await service.read.paymentCollection(api.container, collection.id)).paymentSessions?.length

    const paymentService = api.container.resolve<IPaymentModuleService>(Modules.PAYMENT)
    vi.spyOn(paymentService, 'capturePayment').mockRejectedValue(new Error('gateway refused the capture'))

    const { status } = await api.post<ApiErrorBody>(`/admin/payment-collections/${collection.id}/mark-as-paid`)

    expect(status).toBe(500)

    // No orphaned session, no orphaned payment, and the collection still owes what it owed.
    const after = await service.read.paymentCollection(api.container, collection.id)
    expect(after.paymentSessions?.length).toBe(sessionsBefore)
    expect(after.payments ?? []).toEqual([])
    expect(after.status).not.toBe('completed')
  })
})
