import type { FindConfig } from '../../../src/core/types/common.js'
import type { AppContainer } from '../../../src/core/types/container.js'
import type {
  FilterableOrderAddressProps,
  FilterableOrderProps,
  OrderAddressDTO,
} from '../../../src/core/types/order/common.js'
import type { UpdateOrderDTO } from '../../../src/core/types/order/mutations.js'
import { ContainerRegistrationKeys } from '../../../src/core/utils/container.js'
import { Modules } from '../../../src/core/utils/modules-definition.js'
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
export async function createOrder(container: AppContainer, options?: CreateCheckoutReadyCartOptions) {
  const checkout = await createCheckoutReadyCart(container, options)
  const order = await completeCartWorkflow.run({ cartId: checkout.cart.id })

  return { ...checkout, order }
}

export async function listOrders(container: AppContainer, filters?: FilterableOrderProps) {
  const orderService = container.resolve(Modules.ORDER)

  return orderService.listOrders(filters)
}

export type FulfillOrderOptions = {
  /** Omitted, the workflow ships from the location the order's stock is reserved at. */
  locationId?: string
  /** Defaults to every line item at its full quantity, which is the only request the workflow
   *  accepts. Name items to make a partial one, which it refuses. */
  items?: { lineItemId?: string; title: string; quantity: number }[]
}

/**
 * Drives an order to `fulfilled` the way the admin does, and returns the fulfillment the
 * workflow created — the id every downstream workflow (`ship`, `deliver`) is keyed on, and
 * which the workflow itself does not hand back.
 */
export async function fulfillOrder(container: AppContainer, orderId: string, options?: FulfillOrderOptions) {
  const orderService = container.resolve(Modules.ORDER)
  const linkService = container.resolve(ContainerRegistrationKeys.LINK)

  const lineItems = await orderService.listOrderLineItems({ orderId })
  const items =
    options?.items ?? lineItems.map((item) => ({ lineItemId: item.id, title: item.title, quantity: item.quantity }))

  const order = await createOrderFulfillmentWorkflow.run({
    orderId,
    fulfillmentData: {
      providerId: 'manual',
      items,
      address: { firstName: 'John', lastName: 'Doe' },
      ...(options?.locationId ? { locationId: options.locationId } : {}),
    },
  })

  const link = await linkService.repo('orderFulfillment').findByOrderId(orderId)
  if (!link) throw new Error(`No fulfillment linked to order "${orderId}" after fulfilling it`)

  return { order, fulfillmentId: link.fulfillmentId }
}

/** An order driven all the way to `shipped`, for the workflows that start from there. */
export async function shipOrder(container: AppContainer, orderId: string, options?: FulfillOrderOptions) {
  const { fulfillmentId } = await fulfillOrder(container, orderId, options)
  const order = await createOrderShipmentWorkflow.run({ orderId, fulfillmentId })

  return { order, fulfillmentId }
}

// ---- Update ----

/**
 * A direct write to the order row, for arranging states no workflow will produce — a canceled
 * order that has already shipped, for instance, which `cancel-order` refuses to create.
 */
export async function updateOrder(container: AppContainer, orderId: string, overrides?: Partial<UpdateOrderDTO>) {
  const orderService = container.resolve(Modules.ORDER)

  return orderService.updateOrder(orderId, generateUpdateOrderDTO(overrides))
}

// ---- Reads ----

export async function listOrderLineItems(container: AppContainer, orderId: string) {
  const orderService = container.resolve(Modules.ORDER)

  return orderService.listOrderLineItems({ orderId })
}

export async function retrieveOrder(container: AppContainer, orderId: string) {
  const orderService = container.resolve(Modules.ORDER)

  return orderService.retrieveOrder(orderId)
}

export async function listOrderTransactions(container: AppContainer, orderId: string) {
  const orderService = container.resolve(Modules.ORDER)

  return orderService.listOrderTransactions({ orderId })
}

export async function listOrderShippingMethods(container: AppContainer, orderId: string) {
  const orderService = container.resolve(Modules.ORDER)

  return orderService.listOrderShippingMethods({ orderId })
}

export async function listOrderAddresses(
  container: AppContainer,
  filters?: FilterableOrderAddressProps,
  config?: FindConfig<OrderAddressDTO>,
) {
  const orderService = container.resolve(Modules.ORDER)

  return orderService.listOrderAddresses(filters, config)
}
