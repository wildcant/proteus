import { BigNumber } from '@core/db/bignum.js'
import { ErrorTypes } from '@core/errors/app-error.js'
import { test } from '@tests/setup/test-extend.js'
import { describe } from 'vitest'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import {
  OrderAddressRepository,
  OrderLineItemRepository,
  OrderRepository,
  OrderShippingMethodRepository,
  OrderTransactionRepository,
} from '../repositories/index.js'
import { OrderModuleService } from '../services/order-module-service.js'

let service: OrderModuleService

test.beforeEach(({ getDb, logger }) => {
  service = new OrderModuleService({
    orderRepository: new OrderRepository({ getDb }),
    orderAddressRepository: new OrderAddressRepository({ getDb }),
    orderLineItemRepository: new OrderLineItemRepository({ getDb }),
    orderShippingMethodRepository: new OrderShippingMethodRepository({ getDb }),
    orderTransactionRepository: new OrderTransactionRepository({ getDb }),
    withTransaction: createWithTransaction(getDb),
    logger,
  })
})

describe('OrderModuleService', () => {
  // ---------------------------------------------------------------------------
  // Order CRUD
  // ---------------------------------------------------------------------------

  describe('Order CRUD', () => {
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

  describe('Order Address', () => {
    test('createOrderAddress — creates a snapshot address', async ({ expect, dto }) => {
      const address = await service.createOrderAddress(dto.generate.createOrderAddress())

      expect(address.id).toMatch(/^ordaddr_/)
      expect(address.firstName).toBe('John')
      expect(address.lastName).toBe('Doe')
    })

    test('createOrderAddresses — bulk create', async ({ expect, dto }) => {
      const addresses = await service.createOrderAddresses([
        dto.generate.createOrderAddress(),
        dto.generate.createOrderAddress({ firstName: 'Jane' }),
      ])

      expect(addresses).toHaveLength(2)
    })

    test('updateOrderAddress — updates fields', async ({ expect, dto }) => {
      const address = await service.createOrderAddress(dto.generate.createOrderAddress())
      const updated = await service.updateOrderAddress(address.id, { city: 'New York' })

      expect(updated.city).toBe('New York')
    })

    test('deleteOrderAddresses — hard deletes', async ({ expect, dto }) => {
      const address = await service.createOrderAddress(dto.generate.createOrderAddress())
      await service.deleteOrderAddresses([address.id])

      await expect(service.updateOrderAddress(address.id, { city: 'X' })).rejects.toMatchObject({
        type: ErrorTypes.NOT_FOUND,
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Line Items
  // ---------------------------------------------------------------------------

  describe('Line Items', () => {
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

  describe('Shipping Methods', () => {
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

  describe('Transactions', () => {
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

  describe('Lifecycle — valid transitions', () => {
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

  describe('Lifecycle — invalid transitions', () => {
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

  describe('Cascade delete', () => {
    test('deleteOrders — cascades to line items, shipping methods, and transactions', async ({ expect, dto }) => {
      const order = await service.createOrder(
        dto.generate.createOrder({
          items: [dto.generate.createOrderLineItem()],
          shippingMethods: [dto.generate.createOrderShippingMethod()],
        }),
      )
      await service.addOrderTransaction(dto.generate.createOrderTransaction({ orderId: order.id }))

      await service.deleteOrders([order.id])

      const lineItems = await service.listOrderLineItems({ orderId: order.id })
      const shippingMethods = await service.listOrderShippingMethods({ orderId: order.id })
      const transactions = await service.listOrderTransactions({ orderId: order.id })

      expect(lineItems).toHaveLength(0)
      expect(shippingMethods).toHaveLength(0)
      expect(transactions).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Computed totals
  // ---------------------------------------------------------------------------

  describe('Computed totals', () => {
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

      const totals = await service.computeOrderTotals(order.id)

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

    test('computeOrderTotals — zero totals for empty order', async ({ expect, dto }) => {
      const order = await service.createOrder(dto.generate.createOrder())

      const totals = await service.computeOrderTotals(order.id)

      expect(totals.itemsTotal).toEqual(new BigNumber(0))
      expect(totals.shippingTotal).toEqual(new BigNumber(0))
      expect(totals.orderTotal).toEqual(new BigNumber(0))
      expect(totals.paidTotal).toEqual(new BigNumber(0))
      expect(totals.outstandingTotal).toEqual(new BigNumber(0))
    })
  })
})
