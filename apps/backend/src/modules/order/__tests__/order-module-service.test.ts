import { BigNumber } from '@core/db/bignum.js'
import { ErrorTypes } from '@core/errors/app-error.js'
import { test } from '@tests/setup/test-extend.js'
import { buildCascadeGraph } from '../../../core/db/cascade-graph.js'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import * as models from '../models/index.js'
import {
  OrderAddressRepository,
  OrderLineItemRepository,
  OrderRepository,
  OrderShippingMethodRepository,
  OrderTransactionRepository,
} from '../repositories/index.js'
import { OrderModuleService } from '../services/order-module-service.js'

const cascadeGraph = buildCascadeGraph(models)

let service: OrderModuleService
let orderRepository: OrderRepository

test.beforeEach(({ getDb, logger }) => {
  orderRepository = new OrderRepository({ getDb, cascadeGraph })
  service = new OrderModuleService({
    orderRepository,
    orderAddressRepository: new OrderAddressRepository({ getDb, cascadeGraph }),
    orderLineItemRepository: new OrderLineItemRepository({ getDb, cascadeGraph }),
    orderShippingMethodRepository: new OrderShippingMethodRepository({ getDb, cascadeGraph }),
    orderTransactionRepository: new OrderTransactionRepository({ getDb, cascadeGraph }),
    withTransaction: createWithTransaction(getDb),
    logger,
  })
})

test.describe('OrderModuleService', () => {
  // ---------------------------------------------------------------------------
  // Order CRUD
  // ---------------------------------------------------------------------------

  test.describe('Order CRUD', () => {
    test('createOrder — creates an order with defaults', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())

      expect(order.id).toMatch(/^ord_/)
      expect(order.status).toBe('pending')
      expect(order.fulfillmentStatus).toBe('unfulfilled')
      expect(order.currencyCode).toBe('usd')
      expect(order.displayId).toBeGreaterThan(0)
    })

    test('createOrder — with inline items and shipping methods', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({
          items: [dto.generate.createOrderLineItem(), dto.generate.createOrderLineItem({ quantity: 3 })],
          shippingMethods: [dto.generate.createOrderShippingMethod()],
        }),
      )

      const lineItems = await service.listOrderLineItems({ orderId: order.id })
      const shippingMethods = await service.listOrderShippingMethods({ orderId: order.id })

      expect(lineItems).toHaveLength(2)
      expect(shippingMethods).toHaveLength(1)
    })

    test('createOrders — bulk create', async ({ expect, dto }) => {
      const orders = await service.createOrders([dto.generate.createOrder(), dto.generate.createOrder()])

      expect(orders).toHaveLength(2)
      expect(orders[0]?.id).toMatch(/^ord_/)
      expect(orders[1]?.id).toMatch(/^ord_/)
    })

    test('retrieveOrder — returns existing order', async ({ expect, dto }) => {
      const created = await service.createOrder(dto.generate.createOrder())
      const retrieved = await service.retrieveOrder(created.id)

      expect(retrieved.id).toBe(created.id)
      expect(retrieved.currencyCode).toBe('usd')
    })

    test('retrieveOrder — throws NOT_FOUND for missing id', async ({ expect }) => {
      await expect(service.retrieveOrder('ord_nonexistent')).rejects.toMatchObject({
        type: ErrorTypes.NOT_FOUND,
      })
    })

    test('listOrders — returns all orders', async ({ expect, dto }) => {
      await service.createOrders([dto.generate.createOrder(), dto.generate.createOrder()])

      const orders = await service.listOrders()
      expect(orders.length).toBeGreaterThanOrEqual(2)
    })

    test('listAndCountOrders — returns count', async ({ expect, dto }) => {
      await service.createOrders([
        dto.generate.createOrder({ currencyCode: 'eur' }),
        dto.generate.createOrder({ currencyCode: 'eur' }),
      ])

      const [orders, count] = await service.listAndCountOrders({ currencyCode: 'eur' })
      expect(orders).toHaveLength(2)
      expect(count).toBe(2)
    })

    test('updateOrder — updates fields', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())
      const updated = await service.updateOrder(order.id, { email: 'new@example.com' })

      expect(updated.email).toBe('new@example.com')
    })

    test('updateOrders — bulk update', async ({ expect, dto }) => {
      const orders = await service.createOrders([dto.generate.createOrder(), dto.generate.createOrder()])
      const ids = orders.map((o) => o.id)

      const updated = await service.updateOrders(ids, { email: 'bulk@example.com' })

      expect(updated).toHaveLength(2)
      for (const order of updated) {
        expect(order.email).toBe('bulk@example.com')
      }
    })

    test('softDeleteOrders — soft-deletes and restores', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())

      await service.softDeleteOrders([order.id])

      const listed = await service.listOrders({ id: order.id })
      expect(listed).toHaveLength(0)

      await service.restoreOrders([order.id])

      const restored = await service.listOrders({ id: order.id })
      expect(restored).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Address
  // ---------------------------------------------------------------------------

  test.describe('Order Address', () => {
    test('createOrder — snapshots the addresses nested in the payload', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({
          shippingAddress: dto.generate.createOrderAddress(),
          billingAddress: dto.generate.createOrderAddress({ firstName: 'Jane' }),
        }),
      )

      const addresses = await service.listOrderAddresses({ orderId: order.id })

      expect(addresses.map((address) => address.type).sort()).toEqual(['billing', 'shipping'])
      expect(addresses.every((address) => address.id.startsWith('ordaddr_'))).toBe(true)
      expect(addresses.find((address) => address.type === 'shipping')).toMatchObject({ firstName: 'John' })
      expect(addresses.find((address) => address.type === 'billing')).toMatchObject({ firstName: 'Jane' })
    })

    test('retrieveOrderAddress — returns the address filling that type', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({ shippingAddress: dto.generate.createOrderAddress() }),
      )

      expect(await service.retrieveOrderAddress(order.id, 'shipping')).toMatchObject({
        orderId: order.id,
        type: 'shipping',
      })
    })

    test('retrieveOrderAddress — null when the order has no address of that type', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({ shippingAddress: dto.generate.createOrderAddress() }),
      )

      // Absence is legal — an order can ship without a separate billing address — so this is a
      // null rather than the not-found throw the other retrieve methods use.
      expect(await service.retrieveOrderAddress(order.id, 'billing')).toBeNull()
    })

    test('createOrderAddress — fills one type on an existing order', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())
      const address = await service.createOrderAddress(order.id, 'shipping', dto.generate.createOrderAddress())

      expect(address).toMatchObject({ orderId: order.id, type: 'shipping', lastName: 'Doe' })
    })

    test('createOrderAddress — refuses a second address of the same type', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({ shippingAddress: dto.generate.createOrderAddress() }),
      )

      await expect(
        service.createOrderAddress(order.id, 'shipping', dto.generate.createOrderAddress()),
      ).rejects.toMatchObject({ type: ErrorTypes.DUPLICATE_ERROR })
    })

    test('createOrderAddress — refuses an address with no order to belong to', async ({ expect, dto }) => {
      await expect(
        service.createOrderAddress('ord_nonexistent', 'shipping', dto.generate.createOrderAddress()),
      ).rejects.toMatchObject({ type: ErrorTypes.NOT_FOUND })
    })

    test('updateOrderAddress — updates fields', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({ shippingAddress: dto.generate.createOrderAddress() }),
      )
      const address = await service.retrieveOrderAddress(order.id, 'shipping')
      if (!address) throw new Error('expected the order to own a shipping address')

      const updated = await service.updateOrderAddress(address.id, { city: 'New York' })

      expect(updated.city).toBe('New York')
    })

    test('softDeleteOrderAddresses — hides the address', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({ shippingAddress: dto.generate.createOrderAddress() }),
      )
      const address = await service.retrieveOrderAddress(order.id, 'shipping')
      if (!address) throw new Error('expected the order to own a shipping address')

      await service.softDeleteOrderAddresses([address.id])

      await expect(service.updateOrderAddress(address.id, { city: 'X' })).rejects.toMatchObject({
        type: ErrorTypes.NOT_FOUND,
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Address ownership
  //
  // The order used to point at its addresses, so nothing removed them when it went and every
  // rolled-back checkout left up to two rows behind. These assert what a later read gives back.
  // ---------------------------------------------------------------------------

  test.describe('Address ownership', () => {
    test('softDeleteOrders — hides the order addresses', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({
          shippingAddress: dto.generate.createOrderAddress(),
          billingAddress: dto.generate.createOrderAddress(),
        }),
      )

      await service.softDeleteOrders([order.id])

      expect(await service.listOrderAddresses({ orderId: order.id })).toHaveLength(0)
    })

    test('restoreOrders — brings the addresses back', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({
          shippingAddress: dto.generate.createOrderAddress(),
          billingAddress: dto.generate.createOrderAddress(),
        }),
      )

      await service.softDeleteOrders([order.id])
      await service.restoreOrders([order.id])

      expect(await service.listOrderAddresses({ orderId: order.id })).toHaveLength(2)
    })

    // The service exposes no hard delete, so this reaches the repository directly: the database
    // cascade is what removes the address rows, and only inversion made it reach them at all.
    test('deleting the order row takes the addresses with it', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({
          shippingAddress: dto.generate.createOrderAddress(),
          billingAddress: dto.generate.createOrderAddress(),
        }),
      )

      await orderRepository.delete([order.id])

      // `withDeleted` so a row merely hidden would still show up — only a real removal passes.
      expect(await service.listOrderAddresses({ orderId: order.id }, { withDeleted: true })).toHaveLength(0)
    })

    test('softDeleteOrders — leaves another order’s addresses alone', async ({ expect, dto }) => {
      const bothAddresses = () =>
        dto.generate.createOrder({
          shippingAddress: dto.generate.createOrderAddress(),
          billingAddress: dto.generate.createOrderAddress(),
        })
      const deleted = await service.createOrder(bothAddresses())
      const kept = await service.createOrder(bothAddresses())

      await service.softDeleteOrders([deleted.id])

      expect(await service.listOrderAddresses({ orderId: kept.id })).toHaveLength(2)
    })
  })

  // ---------------------------------------------------------------------------
  // Line Items
  // ---------------------------------------------------------------------------

  test.describe('Line Items', () => {
    test('createOrderLineItems — creates items for an order', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())
      const items = await service.createOrderLineItems(order.id, [
        dto.generate.createOrderLineItem(),
        dto.generate.createOrderLineItem({ title: 'Another Product', quantity: 2 }),
      ])

      expect(items).toHaveLength(2)
      expect(items[0]?.id).toMatch(/^ordli_/)
      expect(items[0]?.orderId).toBe(order.id)
    })

    test('createOrderLineItems — throws for non-existent order', async ({ expect, dto }) => {
      await expect(
        service.createOrderLineItems('ord_nonexistent', [dto.generate.createOrderLineItem()]),
      ).rejects.toMatchObject({ type: ErrorTypes.NOT_FOUND })
    })

    test('listOrderLineItems — filters by orderId', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder({ items: [dto.generate.createOrderLineItem()] }))

      const items = await service.listOrderLineItems({ orderId: order.id })
      expect(items).toHaveLength(1)
      expect(items[0]?.orderId).toBe(order.id)
    })
  })

  // ---------------------------------------------------------------------------
  // Shipping Methods
  // ---------------------------------------------------------------------------

  test.describe('Shipping Methods', () => {
    test('createOrderShippingMethods — creates methods for an order', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())
      const methods = await service.createOrderShippingMethods(order.id, [
        dto.generate.createOrderShippingMethod(),
        dto.generate.createOrderShippingMethod({ name: 'Express Shipping', amount: new BigNumber(1500) }),
      ])

      expect(methods).toHaveLength(2)
      expect(methods[0]?.id).toMatch(/^ordsm_/)
      expect(methods[0]?.orderId).toBe(order.id)
    })

    test('createOrderShippingMethods — throws for non-existent order', async ({ expect, dto }) => {
      await expect(
        service.createOrderShippingMethods('ord_nonexistent', [dto.generate.createOrderShippingMethod()]),
      ).rejects.toMatchObject({ type: ErrorTypes.NOT_FOUND })
    })

    test('listOrderShippingMethods — filters by orderId', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({ shippingMethods: [dto.generate.createOrderShippingMethod()] }),
      )

      const methods = await service.listOrderShippingMethods({ orderId: order.id })
      expect(methods).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

  test.describe('Transactions', () => {
    test('addOrderTransaction — creates a transaction', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())
      const transaction = await service.addOrderTransaction(dto.generate.createOrderTransaction({ orderId: order.id }))

      expect(transaction.id).toMatch(/^ordtrx_/)
      expect(transaction.orderId).toBe(order.id)
      expect(transaction.amount).toEqual(new BigNumber(10500))
      expect(transaction.reference).toBe('capture')
    })

    test('addOrderTransaction — throws for non-existent order', async ({ expect, dto }) => {
      await expect(
        service.addOrderTransaction(dto.generate.createOrderTransaction({ orderId: 'ord_nonexistent' })),
      ).rejects.toMatchObject({ type: ErrorTypes.NOT_FOUND })
    })

    test('addOrderTransactions — bulk create', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())
      const transactions = await service.addOrderTransactions([
        dto.generate.createOrderTransaction({ orderId: order.id, amount: new BigNumber(5000) }),
        dto.generate.createOrderTransaction({ orderId: order.id, amount: new BigNumber(5500) }),
      ])

      expect(transactions).toHaveLength(2)
    })

    test('listOrderTransactions — filters by orderId', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())
      await service.addOrderTransaction(dto.generate.createOrderTransaction({ orderId: order.id }))

      const transactions = await service.listOrderTransactions({ orderId: order.id })
      expect(transactions).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Lifecycle — valid transitions
  // ---------------------------------------------------------------------------

  test.describe('Lifecycle — valid transitions', () => {
    test('completeOrder — pending -> completed', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())
      const completed = await service.completeOrder(order.id)

      expect(completed.status).toBe('completed')
    })

    test('cancelOrder — pending + unfulfilled -> canceled', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())
      const canceled = await service.cancelOrder(order.id)

      expect(canceled.status).toBe('canceled')
      expect(canceled.canceledAt).toBeInstanceOf(Date)
    })

    test('archiveOrder — completed -> archived', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())
      await service.completeOrder(order.id)
      const archived = await service.archiveOrder(order.id)

      expect(archived.status).toBe('archived')
    })
  })

  // ---------------------------------------------------------------------------
  // Lifecycle — invalid transitions
  // ---------------------------------------------------------------------------

  test.describe('Lifecycle — invalid transitions', () => {
    test('completeOrder — rejects non-pending order', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())
      await service.completeOrder(order.id)

      await expect(service.completeOrder(order.id)).rejects.toMatchObject({
        type: ErrorTypes.NOT_ALLOWED,
      })
    })

    test('cancelOrder — rejects non-pending order', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())
      await service.completeOrder(order.id)

      await expect(service.cancelOrder(order.id)).rejects.toMatchObject({
        type: ErrorTypes.NOT_ALLOWED,
      })
    })

    test('archiveOrder — rejects non-completed order', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())

      await expect(service.archiveOrder(order.id)).rejects.toMatchObject({
        type: ErrorTypes.NOT_ALLOWED,
      })
    })

    test('archiveOrder — rejects canceled order', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())
      await service.cancelOrder(order.id)

      await expect(service.archiveOrder(order.id)).rejects.toMatchObject({
        type: ErrorTypes.NOT_ALLOWED,
      })
    })

    test('cancelOrder — rejects already canceled order', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())
      await service.cancelOrder(order.id)

      await expect(service.cancelOrder(order.id)).rejects.toMatchObject({
        type: ErrorTypes.NOT_ALLOWED,
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Cascade delete
  // ---------------------------------------------------------------------------

  test.describe('Cascade delete', () => {
    test('softDeleteOrders — cascades to line items, shipping methods, and transactions', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({
          items: [dto.generate.createOrderLineItem()],
          shippingMethods: [dto.generate.createOrderShippingMethod()],
        }),
      )
      await service.addOrderTransaction(dto.generate.createOrderTransaction({ orderId: order.id }))

      await service.softDeleteOrders([order.id])

      const lineItems = await service.listOrderLineItems({ orderId: order.id })
      const shippingMethods = await service.listOrderShippingMethods({ orderId: order.id })
      const transactions = await service.listOrderTransactions({ orderId: order.id })

      expect(lineItems).toHaveLength(0)
      expect(shippingMethods).toHaveLength(0)
      expect(transactions).toHaveLength(0)
    })

    test('softDeleteOrders — hides line items, shipping methods and transactions', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({
          items: [dto.generate.createOrderLineItem(), dto.generate.createOrderLineItem()],
          shippingMethods: [dto.generate.createOrderShippingMethod()],
        }),
      )
      await service.addOrderTransaction(dto.generate.createOrderTransaction({ orderId: order.id }))

      await service.softDeleteOrders([order.id])

      expect(await service.listOrderLineItems({ orderId: order.id })).toHaveLength(0)
      expect(await service.listOrderShippingMethods({ orderId: order.id })).toHaveLength(0)
      expect(await service.listOrderTransactions({ orderId: order.id })).toHaveLength(0)
    })

    test('restoreOrders — brings back everything that deletion hid', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({
          items: [dto.generate.createOrderLineItem(), dto.generate.createOrderLineItem()],
          shippingMethods: [dto.generate.createOrderShippingMethod()],
        }),
      )
      await service.addOrderTransaction(dto.generate.createOrderTransaction({ orderId: order.id }))

      await service.softDeleteOrders([order.id])
      await service.restoreOrders([order.id])

      expect(await service.listOrders({ id: order.id })).toHaveLength(1)
      expect(await service.listOrderLineItems({ orderId: order.id })).toHaveLength(2)
      expect(await service.listOrderShippingMethods({ orderId: order.id })).toHaveLength(1)
      expect(await service.listOrderTransactions({ orderId: order.id })).toHaveLength(1)
    })

    test('softDeleteOrders — leaves another order untouched', async ({ expect, dto }) => {
      const [deleted, kept] = await service.createOrders([
        dto.generate.createOrder({ items: [dto.generate.createOrderLineItem()] }),
        dto.generate.createOrder({ items: [dto.generate.createOrderLineItem()] }),
      ])
      if (!deleted || !kept) throw new Error('expected two orders')

      await service.softDeleteOrders([deleted.id])

      expect(await service.listOrderLineItems({ orderId: kept.id })).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Computed totals
  // ---------------------------------------------------------------------------

  test.describe('Computed totals', () => {
    test('computeOrderTotals — calculates correct totals with BigNumber', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({
          items: [
            dto.generate.createOrderLineItem({ unitPrice: new BigNumber(10000), quantity: 2 }),
            dto.generate.createOrderLineItem({ unitPrice: new BigNumber(5000), quantity: 1 }),
          ],
          shippingMethods: [dto.generate.createOrderShippingMethod({ amount: new BigNumber(1500) })],
        }),
      )

      await service.addOrderTransaction(
        dto.generate.createOrderTransaction({ orderId: order.id, amount: new BigNumber(26500) }),
      )

      const [lineItems, shippingMethods, transactions] = await Promise.all([
        service.listOrderLineItems({ orderId: order.id }),
        service.listOrderShippingMethods({ orderId: order.id }),
        service.listOrderTransactions({ orderId: order.id }),
      ])
      const totals = service.computeOrderTotals({ lineItems, shippingMethods, transactions })

      // itemsTotal = (10000 * 2) + (5000 * 1) = 25000
      expect(totals.itemsTotal).toEqual(new BigNumber(25000))
      // shippingTotal = 1500
      expect(totals.shippingTotal).toEqual(new BigNumber(1500))
      // orderTotal = 25000 + 1500 = 26500
      expect(totals.orderTotal).toEqual(new BigNumber(26500))
      // paidTotal = 26500
      expect(totals.paidTotal).toEqual(new BigNumber(26500))
      // outstandingTotal = 26500 - 26500 = 0
      expect(totals.outstandingTotal).toEqual(new BigNumber(0))
    })

    test('computeOrderTotals — zero totals for empty order', ({ expect }) => {
      const totals = service.computeOrderTotals({ lineItems: [], shippingMethods: [], transactions: [] })

      expect(totals.itemsTotal).toEqual(new BigNumber(0))
      expect(totals.shippingTotal).toEqual(new BigNumber(0))
      expect(totals.orderTotal).toEqual(new BigNumber(0))
      expect(totals.paidTotal).toEqual(new BigNumber(0))
      expect(totals.outstandingTotal).toEqual(new BigNumber(0))
    })
  })
})
