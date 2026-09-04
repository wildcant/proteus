import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { BigNumber } from '../../../src/core/bignumber.js'
import type { CreateOrder, CreateOrderAddress, CreateOrderLineItem } from '../../../src/modules/order/models/index.js'
import { orderAddressTable, orderLineItemTable, orderTable } from '../../../src/modules/order/models/index.js'
import { db } from '../../db/client.js'

/**
 * A placed order, written straight to the table: the order, the address it was delivered to and
 * one line item, which is the least an order page has to render.
 *
 * The checkout workflow is the only thing that writes a real one, and driving it is what the
 * checkout and orders specs do. This exists for the orders a checkout can no longer produce — an
 * order delivered to a country the store has since stopped selling to. The market decides where a
 * parcel goes now, so the storefront cannot address one abroad, and the record of one placed
 * before that has to come from here.
 *
 * The order module's tables are not in `src/schema.ts` — nothing outside the module reads them —
 * so they are imported from the module, which `no-module-internals` allows `tests/` to do.
 */

type CreateOrderOptions = {
  order?: Partial<CreateOrder>
  shippingAddress?: Partial<CreateOrderAddress>
  lineItem?: Partial<CreateOrderLineItem>
}

export function generateOrder(overrides?: Partial<CreateOrder>): CreateOrder {
  return {
    status: 'pending',
    fulfillmentStatus: 'unfulfilled',
    email: faker.internet.email(),
    customerId: null,
    currencyCode: 'usd',
    canceledAt: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createOrder(options: CreateOrderOptions = {}) {
  const result = await db.insert(orderTable).values(generateOrder(options.order)).returning()
  const order = result[0]
  if (!order) throw new Error('Order insert returned no rows')

  const addressResult = await db
    .insert(orderAddressTable)
    .values({
      orderId: order.id,
      type: 'shipping',
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      address1: faker.location.streetAddress(),
      city: faker.location.city(),
      // No default: an order exists here because of where it went, so every caller names it.
      countryCode: 'us',
      postalCode: faker.location.zipCode(),
      ...options.shippingAddress,
    })
    .returning()
  const shippingAddress = addressResult[0]
  if (!shippingAddress) throw new Error('Order address insert returned no rows')

  const lineItemResult = await db
    .insert(orderLineItemTable)
    .values({
      orderId: order.id,
      title: faker.commerce.productName(),
      quantity: 1,
      unitPrice: new BigNumber('25.00'),
      ...options.lineItem,
    })
    .returning()
  const lineItem = lineItemResult[0]
  if (!lineItem) throw new Error('Order line item insert returned no rows')

  return {
    ...order,
    shippingAddress,
    lineItem,
    [Symbol.asyncDispose]: async () => {
      // The address and the line item reference the order with `on delete cascade`.
      await deleteOrderById(order.id)
    },
  }
}

export async function deleteOrderById(orderId: string) {
  await db.delete(orderTable).where(eq(orderTable.id, orderId))
}
