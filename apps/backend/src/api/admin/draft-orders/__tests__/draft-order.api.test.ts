import type { AdminDraftOrderListResponse, AdminOrderListResponse } from '@proteus/http-schemas/admin'
import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import orderDefinitions from '../../orders/definitions.js'
import draftOrderDefinitions from '../definitions.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: [...orderDefinitions, ...draftOrderDefinitions] })
})

test.describe('GET /admin/draft-orders', () => {
  /**
   * Only confirmed orders read as orders. A draft the shop canceled is `canceled` like any other
   * order, and it still belongs with the drafts: that is what the flag beside the status is for.
   */
  test('lists the drafts, canceled ones included, and the orders list leaves them out', async ({ service, expect }) => {
    const { order } = await service.create.order(api.container)
    const draft = await service.create.draftOrder(api.container, { email: null })
    const canceledDraft = await service.create.draftOrder(api.container)
    await service.update.order(api.container, canceledDraft.id, { status: 'canceled' })

    const orders = await api.get<AdminOrderListResponse>('/admin/orders')
    const drafts = await api.get<AdminDraftOrderListResponse>('/admin/draft-orders')

    expect(orders.body).toMatchObject({ count: 1, orders: [{ id: order.id, reference: String(order.displayId) }] })
    expect(drafts.body.count).toBe(2)
    expect(drafts.body.draftOrders.map((draftOrder) => draftOrder.id).sort()).toEqual(
      [draft.id, canceledDraft.id].sort(),
    )
    expect(drafts.body.draftOrders).toContainEqual(
      expect.objectContaining({ id: draft.id, status: 'draft', email: null, reference: String(draft.displayId) }),
    )
  })
})
