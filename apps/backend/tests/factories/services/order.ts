import type { AwilixContainer } from 'awilix'
import type { ILinkService } from '../../../src/core/types/link/service.js'
import type { FilterableOrderProps } from '../../../src/core/types/order/common.js'
import type { UpdateOrderDTO } from '../../../src/core/types/order/mutations.js'
import type { IOrderModuleService } from '../../../src/core/types/order/service.js'
import { ContainerRegistrationKeys, Modules } from '../../../src/core/utils/index.js'
import { completeCartWorkflow } from '../../../src/workflows/cart/complete-cart.js'
import { createOrderFulfillmentWorkflow } from '../../../src/workflows/order/create-order-fulfillment.js'
import { createOrderShipmentWorkflow } from '../../../src/workflows/order/create-order-shipment.js'
import { generateUpdateOrderDTO } from '../order-dto.js'
import { type CreateCheckoutReadyCartOptions, createCheckoutReadyCart } from './checkout.js'

/**
 * An order in the state production leaves one in: created by completing a checkout-ready cart,
 * so its line items, addresses, payment collection, links and reservations are all real and
 * consistent with each other. Nothing downstream — fulfilling, shipping, cancelling — works
 * against an order assembled any other way.
 *
 * Everything the checkout created is returned alongside the order; take what you need.
 */
export async function createOrder(container: AwilixContainer, options?: CreateCheckoutReadyCartOptions) {
  const checkout = await createCheckoutReadyCart(container, options)
  const order = await completeCartWorkflow.run({ cartId: checkout.cart.id })

  return { ...checkout, order }
}

export async function listOrders(container: AwilixContainer, filters?: FilterableOrderProps) {
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

  return orderService.listOrders(filters)
}

export type FulfillOrderOptions = {
  locationId?: string
  /** Defaults to everything on the order. Name items to fulfil a subset. */
  items?: { lineItemId?: string; title: string; quantity: number }[]
}

/**
 * Drives an order to `fulfilled` the way the admin does, and returns the fulfillment the
 * workflow created — the id every downstream workflow (`ship`, `deliver`) is keyed on, and
 * which the workflow itself does not hand back.
 */
export async function fulfillOrder(container: AwilixContainer, orderId: string, options?: FulfillOrderOptions) {
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
  const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

  const lineItems = await orderService.listOrderLineItems({ orderId })
  const items = options?.items ?? lineItems.map((item) => ({ title: item.title, quantity: item.quantity }))

  const order = await createOrderFulfillmentWorkflow.run({
    orderId,
    locationId: options?.locationId ?? 'sloc_default',
    fulfillmentData: { providerId: 'manual', items, address: { firstName: 'John', lastName: 'Doe' } },
  })

  const link = await linkService.repo('orderFulfillment').findByOrderId(orderId)
  if (!link) throw new Error(`No fulfillment linked to order "${orderId}" after fulfilling it`)

  return { order, fulfillmentId: link.fulfillmentId }
}

/** An order driven all the way to `shipped`, for the workflows that start from there. */
export async function shipOrder(container: AwilixContainer, orderId: string, options?: FulfillOrderOptions) {
  const { fulfillmentId } = await fulfillOrder(container, orderId, options)
  const order = await createOrderShipmentWorkflow.run({ orderId, fulfillmentId })

  return { order, fulfillmentId }
}

// ---- Update ----

/**
 * A direct write to the order row, for arranging states no workflow will produce — a canceled
 * order that has already shipped, for instance, which `cancel-order` refuses to create.
 */
export async function updateOrder(container: AwilixContainer, orderId: string, overrides?: Partial<UpdateOrderDTO>) {
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

  return orderService.updateOrder(orderId, generateUpdateOrderDTO(overrides))
}

// ---- Reads ----

export async function listOrderLineItems(container: AwilixContainer, orderId: string) {
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

  return orderService.listOrderLineItems({ orderId })
}

export async function retrieveOrder(container: AwilixContainer, orderId: string) {
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

  return orderService.retrieveOrder(orderId)
}

export async function listOrderTransactions(container: AwilixContainer, orderId: string) {
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

  return orderService.listOrderTransactions({ orderId })
}

export async function listOrderShippingMethods(container: AwilixContainer, orderId: string) {
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

  return orderService.listOrderShippingMethods({ orderId })
}

export async function retrieveOrderAddress(container: AwilixContainer, addressId: string) {
  const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

  return orderService.retrieveOrderAddress(addressId)
}
