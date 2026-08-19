import { ErrorTypes } from '@core/errors/app-error.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { Logger } from '@core/types/logger.js'
import type { OrderDTO } from '@core/types/order/common.js'
import type { CreateOrderLineItemDTO, CreateOrderShippingMethodDTO } from '@core/types/order/mutations.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import type { PaymentSessionStatus } from '@core/types/payment/common.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { prepareConfirmInventoryInput } from './utils/prepare-confirm-inventory-input.js'

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
  const existingOrder = await ctx.step('check-idempotency', async ({ container }) => {
    const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
    const orderCartLink = await linkService.repo('orderCart').findByCartId(input.cartId)
    if (orderCartLink) {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const cart = await cartService.retrieveCart(input.cartId)
      if (!cart.completedAt) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.UNEXPECTED_STATE,
          message: `Cart "${input.cartId}" has a linked order but was never marked completed — a previous checkout may have partially failed`,
        })
      }
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      return orderService.retrieveOrder(orderCartLink.orderId)
    }
    return null
  })

  if (existingOrder) return existingOrder

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

  // Order is created before payment authorization to minimize the window where captured
  // payments need reversal. If anything after this point fails, compensation rolls back.
  const order = await ctx.step(
    'create-order',
    async ({ container }) => {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

      const cart = await cartService.retrieveCart(input.cartId)

      // Addresses are copied without timestamps so the order keeps an immutable record
      const [shippingAddress, billingAddress] = await Promise.all([
        cart.shippingAddressId ? cartService.retrieveCartAddress(cart.shippingAddressId) : null,
        cart.billingAddressId ? cartService.retrieveCartAddress(cart.billingAddressId) : null,
      ])

      const addressInputs = [shippingAddress, billingAddress]
        .filter((address): address is NonNullable<typeof address> => address != null)
        .map((address) => ({
          customerId: address.customerId,
          company: address.company,
          firstName: address.firstName,
          lastName: address.lastName,
          address1: address.address1,
          address2: address.address2,
          city: address.city,
          countryCode: address.countryCode,
          province: address.province,
          postalCode: address.postalCode,
          phone: address.phone,
        }))

      const createdAddresses = await orderService.createOrderAddresses(addressInputs)

      let orderShippingAddressId: string | undefined
      let orderBillingAddressId: string | undefined
      let addressIndex = 0
      if (shippingAddress) {
        orderShippingAddressId = createdAddresses[addressIndex]?.id
        addressIndex++
      }
      if (billingAddress) {
        orderBillingAddressId = createdAddresses[addressIndex]?.id
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
        shippingAddressId: orderShippingAddressId,
        billingAddressId: orderBillingAddressId,
        items: orderLineItems,
        shippingMethods: orderShippingMethods,
      })

      logger.debug(`[complete-cart] Created order "${createdOrder.id}" from cart "${input.cartId}"`)

      return createdOrder
    },
    async (createdOrder, { container }) => {
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      await orderService.deleteOrders([createdOrder.id])
    },
  )

  // Cross-module links enable idempotency checks and let other modules discover the order
  await ctx.step(
    'link-order',
    async ({ container }) => {
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      await Promise.all([
        linkService.repo('orderCart').create({ orderId: order.id, cartId: input.cartId }),
        linkService.repo('orderPaymentCollection').create({
          orderId: order.id,
          paymentCollectionId: paymentInfo.paymentCollectionId,
        }),
      ])
    },
    async (_result, { container }) => {
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      await linkService.dismissLinks({ orderId: [order.id] })
    },
  )

  // Reservations prevent overselling between order creation and fulfillment
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
      await inventoryService.deleteReservationItems(ids)
    },
  )

  await ctx.step(
    'mark-cart-completed',
    async ({ container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      await cartService.updateCart(input.cartId, { status: 'completed', completedAt: new Date() })
    },
    async (_result, { container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      await cartService.updateCart(input.cartId, { status: 'active', completedAt: null })
    },
  )

  // Payment is authorized last to minimize the window where an authorized/captured payment
  // needs reversal. The provider may auto-capture (e.g. Stripe in automatic mode), in which
  // case the returned payment already has captures. We record those as-is rather than forcing
  // a separate capture call, so deferred flows (bank transfers, manual capture) work correctly.
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

  // The order module tracks its own ledger independently of the payment module.
  // Only record transactions for captures that already happened (provider auto-capture).
  // If the provider only authorized, there are no captures yet — they happen later
  // (e.g. at fulfillment) and are recorded then.
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

  return order
})
