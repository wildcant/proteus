import type { AdminDraftOrderListResponse, AdminOrderListResponse } from '@proteus/http-schemas/admin'
import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { orderReference } from '@workflows/order/utils/order-reference.js'
import orderDefinitions from '../../orders/definitions.js'
import draftOrderDefinitions from '../definitions.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: [...orderDefinitions, ...draftOrderDefinitions] })
})

test.describe('GET /admin/draft-orders', () => {
  /**
   * Only open drafts read as drafts. A draft the shop canceled is done with, so the orders list
   * shows it beside the confirmed orders.
   */
  test('lists the open drafts, and the orders list takes the canceled ones', async ({ service, expect }) => {
    const { order } = await service.create.order(api.container)
    const draft = await service.create.draftOrder(api.container, { email: null })
    const canceledDraft = await service.create.draftOrder(api.container)
    await service.update.order(api.container, canceledDraft.id, { status: 'canceled' })

    const orders = await api.get<AdminOrderListResponse>('/admin/orders')
    const drafts = await api.get<AdminDraftOrderListResponse>('/admin/draft-orders')

    expect(orders.body.count).toBe(2)
    expect(orders.body.orders.map((listed) => listed.id).sort()).toEqual([order.id, canceledDraft.id].sort())
    expect(orders.body.orders).toContainEqual(
      expect.objectContaining({
        id: canceledDraft.id,
        status: 'canceled',
        reference: orderReference(canceledDraft.displayId),
      }),
    )
    expect(drafts.body).toMatchObject({
      count: 1,
      draftOrders: [{ id: draft.id, status: 'draft', email: null, reference: orderReference(draft.displayId) }],
    })
  })
})
