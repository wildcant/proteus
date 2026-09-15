import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import reservationDefinitions from '../definitions.js'
import type * as reservationRoutes from '../route.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: reservationDefinitions })
})

test.describe('GET /admin/reservations', () => {
  test('shows what each order is holding, and the order it belongs to', async ({ service, expect }) => {
    const { order } = await service.create.order(api.container)
    const lineItems = await service.read.orderLineItems(api.container, order.id)
    const [lineItem] = lineItems

    const { status, body } = await api.get<typeof reservationRoutes.GetOutput>('/admin/reservations')

    expect(status).toBe(200)
    expect(body.count).toBe(1)
    expect(body.reservations).toEqual([
      expect.objectContaining({
        quantity: lineItem?.quantity,
        lineItemId: lineItem?.id,
        orderId: order.id,
        orderDisplayId: order.displayId,
        productTitle: lineItem?.productTitle,
        variantTitle: lineItem?.variantTitle,
        sku: lineItem?.variantSku,
      }),
    ])
  })

  test('leaves a reservation no order line item explains unlinked rather than dropping it', async ({
    service,
    expect,
  }) => {
    const { id: locationId } = await service.create.stockLocation(api.container)
    const { product } = await service.create.product(api.container)
    const variant = await service.create.productVariant(api.container, product.id)
    const { inventoryItem } = await service.create.variantStock(api.container, {
      variantId: variant.id,
      level: { locationId, stockedQuantity: 10 },
    })
    await service.create.reservedStock(api.container, {
      inventoryItemId: inventoryItem.id,
      locationId,
      quantity: 3,
      lineItemId: 'orderli_gone',
    })

    const { body } = await api.get<typeof reservationRoutes.GetOutput>('/admin/reservations')

    expect(body.count).toBe(1)
    expect(body.reservations).toEqual([
      expect.objectContaining({ quantity: 3, lineItemId: 'orderli_gone', orderId: null, orderDisplayId: null }),
    ])
  })
})
