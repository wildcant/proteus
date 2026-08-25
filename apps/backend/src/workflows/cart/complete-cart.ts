import { ErrorTypes } from '@core/errors/app-error.js'
import type { CartAddressDTO } from '@core/types/cart/common.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { Logger } from '@core/types/logger.js'
import type { INotificationModuleService } from '@core/types/notification/service.js'
import type { OrderDTO } from '@core/types/order/common.js'
import type {
  CreateOrderAddressDTO,
  CreateOrderLineItemDTO,
  CreateOrderShippingMethodDTO,
} from '@core/types/order/mutations.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import type { PaymentSessionStatus } from '@core/types/payment/common.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { env } from '../../env.js'
import { prepareConfirmInventoryInput } from './utils/prepare-confirm-inventory-input.js'
import { prepareOrderConfirmationData } from './utils/prepare-order-confirmation-data.js'

type CompleteCartInput = { cartId: string }

const PROCESSABLE_STATUSES: PaymentSessionStatus[] = [
  'pending',
  'requires_more',
  'authorized',
  'captured',
  'pending_authorization',
]

// TODO(locking): No distributed lock guards this workflow. Concurrent calls for the same cart
// can produce duplicate orders. Add acquireLock/releaseLock steps once a locking module is available.
export const completeCartWorkflow = createWorkflow<CompleteCartInput, OrderDTO>('complete-cart', async (ctx, input) => {
  /** If this cart was already completed (e.g. retry or concurrent request), return the
   *  existing order instead of creating a duplicate. */
  const existingOrder = await ctx.step('check-idempotency', async ({ container }) => {
    const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
    const orderCartLink = await linkService.repo('orderCart').findByCartId(input.cartId)
    if (!orderCartLink) return null

    const cartService = container.resolve<ICartModuleService>(Modules.CART)
    const cart = await cartService.retrieveCart(input.cartId)

    /** A linked order without `completedAt` is the winner of a concurrent completion still
     *  in flight: it writes the link at `link-order` and stamps `completedAt` several steps
     *  later. A checkout that genuinely died mid-way leaves byte-identical state, and nothing
     *  readable here separates the two — so both get the same answer. The order cannot be
     *  returned yet either way, because payment is not authorized until after this gap and
     *  the whole run can still compensate away. */
    if (!cart.completedAt) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.CONFLICT,
        message: `Cart "${input.cartId}" is already being completed`,
      })
    }

    const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
    return orderService.retrieveOrder(orderCartLink.orderId)
  })

  if (existingOrder) return existingOrder

  /** Reject carts with no items, missing variants, or zero/negative quantities early,
   *  before any side effects (order creation, payment) happen. */
  await ctx.step('validate-cart-items', async ({ container }) => {
    const cartService = container.resolve<ICartModuleService>(Modules.CART)
    const lineItems = await cartService.listLineItems({ cartId: input.cartId })

    if (lineItems.length === 0) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.INVALID_DATA,
        message: `Cart "${input.cartId}" has no items`,
      })
    }

    for (const item of lineItems) {
      if (!item.variantId) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: `Cart item "${item.id}" has no variant`,
        })
      }
      if (item.quantity <= 0) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: `Cart item "${item.id}" has invalid quantity: ${item.quantity}`,
        })
      }
    }
  })

  /** Ensure a payment session exists and is in a processable state before proceeding.
   *  Returns the session/collection IDs needed by the authorize step later. */
  const paymentInfo = await ctx.step('validate-cart-payments', async ({ container }) => {
    const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
    const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

    const cartPaymentLink = await linkService.repo('cartPaymentCollection').findByCartId(input.cartId)
    if (!cartPaymentLink) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.INVALID_DATA,
        message: `Cart "${input.cartId}" has no payment collection`,
      })
    }

    const collection = await paymentService.retrievePaymentCollection(cartPaymentLink.paymentCollectionId)
    const session = collection.paymentSessions?.[0]
    if (!session) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.INVALID_DATA,
        message: `Payment collection "${collection.id}" has no payment session — call POST /store/payment-collections/:id/payment-sessions first`,
      })
    }

    if (!PROCESSABLE_STATUSES.includes(session.status)) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.INVALID_DATA,
        message: `Payment session "${session.id}" is not processable (status: ${session.status})`,
      })
    }

    return {
      sessionId: session.id,
      paymentCollectionId: cartPaymentLink.paymentCollectionId,
      amount: collection.amount,
    }
  })

  /** Verify a shipping method is selected and its underlying option is still enabled.
   *  Options can be disabled between cart creation and checkout. */
  await ctx.step('validate-shipping', async ({ container }) => {
    const cartService = container.resolve<ICartModuleService>(Modules.CART)
    const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

    const shippingMethods = await cartService.listShippingMethods({ cartId: input.cartId })

    if (shippingMethods.length === 0) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.INVALID_DATA,
        message: `Cart "${input.cartId}" has no shipping method — call POST /store/carts/:id/shipping-methods first`,
      })
    }

    await Promise.all(
      shippingMethods.map(async (sm) => {
        if (!sm.shippingOptionId) return
        const option = await fulfillmentService.retrieveShippingOption(sm.shippingOptionId)
        if (!option.isEnabled) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.INVALID_DATA,
            message: `Shipping option "${sm.shippingOptionId}" is no longer available`,
          })
        }
      }),
    )
  })

  /** Final guard against completing a cart that was already finalized. This catches the
   *  window between the idempotency check and order creation (no locking yet). */
  await ctx.step('check-cart-not-completed', async ({ container }) => {
    const cartService = container.resolve<ICartModuleService>(Modules.CART)
    const cart = await cartService.retrieveCart(input.cartId)
    if (cart.completedAt) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Cart "${input.cartId}" is already completed`,
      })
    }
  })

  /** Every order needs an email for receipts and communication. Reject early
   *  before any side effects if the guest never provided one. */
  await ctx.step('validate-cart-email', async ({ container }) => {
    const cartService = container.resolve<ICartModuleService>(Modules.CART)
    const cart = await cartService.retrieveCart(input.cartId)
    if (!cart.email) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.INVALID_DATA,
        message: `Cart "${input.cartId}" has no email — an email is required to complete checkout`,
      })
    }
  })

  /** Snapshot the cart into an immutable order record.
   * If anything after this point fails, compensation deletes the order. */
  const order = await ctx.step(
    'create-order',
    async ({ container }) => {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

      const cart = await cartService.retrieveCart(input.cartId)

      /** The order's addresses are rows it owns, so they are nested into the creation payload
       *  rather than created first and pointed at — the order has to exist before they can.
       *  Copied field by field, so editing the cart's address later cannot rewrite the order's. */
      const cartAddresses = await cartService.listCartAddresses({ cartId: input.cartId })
      const snapshotAddress = (source: CartAddressDTO | undefined): CreateOrderAddressDTO | undefined => {
        if (!source) return undefined
        const { id, cartId, type, createdAt, updatedAt, deletedAt, ...fields } = source
        return fields
      }

      const lineItems = await cartService.listLineItems({ cartId: input.cartId })
      const orderLineItems: CreateOrderLineItemDTO[] = lineItems.map((item) => ({
        title: item.title,
        subtitle: item.subtitle,
        thumbnail: item.thumbnail,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        compareAtUnitPrice: item.compareAtUnitPrice,
        variantId: item.variantId,
        productId: item.productId,
        productTitle: item.productTitle,
        productDescription: item.productDescription,
        productSubtitle: item.productSubtitle,
        productType: item.productType,
        productHandle: item.productHandle,
        variantSku: item.variantSku,
        variantBarcode: item.variantBarcode,
        variantTitle: item.variantTitle,
        variantOptionValues: item.variantOptionValues,
        requiresShipping: item.requiresShipping,
      }))

      const shippingMethods = await cartService.listShippingMethods({ cartId: input.cartId })
      const orderShippingMethods: CreateOrderShippingMethodDTO[] = shippingMethods.map((method) => ({
        name: method.name,
        description: method.description,
        amount: method.amount,
        shippingOptionId: method.shippingOptionId,
        data: method.data ?? undefined,
      }))

      const createdOrder = await orderService.createOrder({
        email: cart.email,
        customerId: cart.customerId,
        currencyCode: cart.currencyCode,
        shippingAddress: snapshotAddress(cartAddresses.find((address) => address.type === 'shipping')),
        billingAddress: snapshotAddress(cartAddresses.find((address) => address.type === 'billing')),
        items: orderLineItems,
        shippingMethods: orderShippingMethods,
      })

      logger.debug(`[complete-cart] Created order "${createdOrder.id}" from cart "${input.cartId}"`)

      return createdOrder
    },
    async (createdOrder, { container }) => {
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      await orderService.softDeleteOrders([createdOrder.id])
    },
  )

  /** Cross-module links enable the idempotency check (order↔cart) and let other modules
   *  discover the order's payment collection (order↔paymentCollection). Created together so a
   *  concurrent completion that loses the race on `orderCart` leaves nothing behind. */
  await ctx.step(
    'link-order',
    async ({ container }) => {
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      await linkService.createMany([
        // Most constrained first: `cartId` is unique, so a duplicate completion stops here.
        { link: 'orderCart', data: { orderId: order.id, cartId: input.cartId } },
        {
          link: 'orderPaymentCollection',
          data: { orderId: order.id, paymentCollectionId: paymentInfo.paymentCollectionId },
        },
      ])
    },
    async (_result, { container }) => {
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      await linkService.dismissLinks({ orderId: [order.id] })
    },
  )

  /** Reserve inventory so the purchased quantities can't be oversold between now
   *  and fulfillment. Reservations are released if later steps fail. */
  await ctx.step(
    'reserve-inventory',
    async ({ container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

      const lineItems = await cartService.listLineItems({ cartId: input.cartId })
      const variantIds = lineItems.map((li) => li.variantId).filter((id) => id != null)
      if (variantIds.length === 0) return []

      const mappings = await linkService.repo('productVariantInventoryItem').findByVariantIds(variantIds)
      const inventoryItemIds = [...new Set(mappings.map((m) => m.inventoryItemId))]
      const levels = await inventoryService.listInventoryLevels({ inventoryItemId: inventoryItemIds })

      const confirmInput = prepareConfirmInventoryInput({
        cartId: input.cartId,
        lineItems,
        mappings,
        levels,
      })

      if (confirmInput.items.length === 0) return []

      const reservations = await inventoryService.createReservationItems(
        confirmInput.items.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          locationId: item.locationIds[0] ?? '',
          quantity: item.quantity * item.requiredQuantity,
          lineItemId: item.lineItemId,
        })),
      )

      return reservations.map((r) => r.id)
    },
    async (ids, { container }) => {
      if (ids.length === 0) return
      const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
      await inventoryService.softDeleteReservationItems(ids)
    },
  )

  /** Stamp `completedAt` so the cart can't be modified or re-checked-out — that timestamp is the
   *  cart's only state. Placed before payment auth so a failure there still leaves it locked. */
  await ctx.step(
    'mark-cart-completed',
    async ({ container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      await cartService.updateCart(input.cartId, { completedAt: new Date() })
    },
    async (_result, { container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      await cartService.updateCart(input.cartId, { completedAt: null })
    },
  )

  /** Authorize the payment session. Placed last to minimize the window where a payment
   *  needs reversal. The provider may auto-capture (e.g. Stripe in automatic mode), in
   *  which case the returned payment already has captures — we don't force a separate
   *  capture call, so deferred flows (bank transfers, manual capture) work correctly. */
  const authorizedPayment = await ctx.step(
    'authorize-payment',
    async ({ container }) => {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
      const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)

      logger.debug(`[complete-cart] Authorizing payment session "${paymentInfo.sessionId}" for cart "${input.cartId}"`)

      const payment = await paymentService.authorizePaymentSession(paymentInfo.sessionId)
      if (!payment) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.UNEXPECTED_STATE,
          message: `Payment authorization failed for session "${paymentInfo.sessionId}"`,
        })
      }

      return payment
    },
    async (payment, { container }) => {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
      const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)

      const hasCaptured = payment.captures && payment.captures.length > 0
      if (hasCaptured) {
        logger.debug(`[complete-cart] Compensating: refunding payment "${payment.id}"`)
        await paymentService.refundPayment({ paymentId: payment.id, amount: payment.amount }).catch((error) => {
          logger.error(error)
        })
      } else {
        logger.debug(`[complete-cart] Compensating: canceling payment "${payment.id}"`)
        await paymentService.cancelPayment(payment.id).catch((error) => {
          logger.error(error)
        })
      }
    },
  )

  /** Record order transactions for any captures the provider already performed. The order
   *  module tracks its own ledger independently of the payment module. If the provider only
   *  authorized (no captures yet), transactions are recorded later when capture happens
   *  (e.g. at fulfillment). */
  await ctx.step('record-transactions', async ({ container }) => {
    const captures = authorizedPayment.captures ?? []
    if (captures.length === 0) return

    const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
    await Promise.all(
      captures.map((capture) =>
        orderService.addOrderTransaction({
          orderId: order.id,
          amount: capture.amount,
          currencyCode: authorizedPayment.currencyCode,
          reference: 'capture',
          referenceId: capture.id,
        }),
      ),
    )
  })

  /** Send the order confirmation email. Deliberately swallows every error: the payment is
   *  already authorized at this point, so throwing would compensate the whole workflow and
   *  refund a valid order over a mail failure. The notification module persists the attempt,
   *  so a failed send is recoverable without re-running checkout. */
  await ctx.step('send-order-confirmation', async ({ container }) => {
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)

    try {
      if (!order.email) return

      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)

      const [lineItems, shippingMethods, transactions, shippingAddress] = await Promise.all([
        orderService.listOrderLineItems({ orderId: order.id }),
        orderService.listOrderShippingMethods({ orderId: order.id }),
        orderService.listOrderTransactions({ orderId: order.id }),
        orderService.retrieveOrderAddress(order.id, 'shipping'),
      ])

      await notificationService.createNotification({
        to: order.email,
        channel: 'email',
        template: 'order-confirmation',
        data: prepareOrderConfirmationData({
          order,
          lineItems: orderService.enrichLineItems(lineItems),
          totals: orderService.computeOrderTotals({ lineItems, shippingMethods, transactions }),
          shippingAddress,
          storeUrl: env.STORE_URL,
        }),
        triggerType: 'order.placed',
        resourceId: order.id,
        resourceType: 'order',
        // Guards against a duplicate email if the workflow is retried after this point.
        idempotencyKey: `order-confirmation:${order.id}`,
      })
    } catch (error) {
      logger.error(`[complete-cart] Failed to send order confirmation for order "${order.id}"`)
      logger.error(error instanceof Error ? error : String(error))
    }
  })

  return order
})
