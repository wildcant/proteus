import { ErrorTypes } from '@core/errors/app-error.js'
import type { CartDTO } from '@core/types/cart/common.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { Logger } from '@core/types/logger.js'
import type { CreateOrderLineItemDTO, CreateOrderShippingMethodDTO } from '@core/types/order/mutations.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { prepareConfirmInventoryInput } from './utils/prepare-confirm-inventory-input.js'

type CompleteCartInput = { cartId: string }

export const completeCartWorkflow = createWorkflow<CompleteCartInput, CartDTO>('complete-cart', async (ctx, input) => {
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

  const existingCart = await ctx.step('check-idempotency', async ({ container }) => {
    const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
    const orderCartLink = await linkService.repo('orderCart').findByCartId(input.cartId)
    if (orderCartLink) {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      return cartService.retrieveCart(input.cartId)
    }
    return null
  })

  if (existingCart) return existingCart

  // Payment must be secured before creating the order to avoid fulfilling unpaid carts
  const capturedPayment = await ctx.step('authorize-and-capture', async ({ container }) => {
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
    const cartService = container.resolve<ICartModuleService>(Modules.CART)
    const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
    const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

    const cart = await cartService.retrieveCart(input.cartId)
    if (cart.status !== 'active') {
      throw new WorkflowTerminalError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Cart "${input.cartId}" is not active (status: ${cart.status})`,
      })
    }

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

    logger.debug(`[complete-cart] Authorizing payment session "${session.id}" for cart "${input.cartId}"`)

    const payment = await paymentService.authorizePaymentSession(session.id)
    if (!payment) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.UNEXPECTED_STATE,
        message: `Payment authorization failed for session "${session.id}"`,
      })
    }

    logger.debug(`[complete-cart] Capturing payment "${payment.id}" for amount ${collection.amount}`)
    const captured = await paymentService.capturePayment({ paymentId: payment.id, amount: collection.amount })

    return { payment: captured, paymentCollectionId: cartPaymentLink.paymentCollectionId }
  })

  // Order is a point-in-time snapshot — cart data is copied so later cart changes don't affect the order
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

      // Cart stores `data` as text; order stores it as jsonb — parse it across the boundary
      const shippingMethods = await cartService.listShippingMethods({ cartId: input.cartId })
      const orderShippingMethods: CreateOrderShippingMethodDTO[] = shippingMethods.map((method) => ({
        name: method.name,
        description: method.description,
        amount: method.amount,
        shippingOptionId: method.shippingOptionId,
        data: method.data ? tryParseJson(method.data) : undefined,
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
          paymentCollectionId: capturedPayment.paymentCollectionId,
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
      const variantIds = lineItems.map((li) => li.variantId).filter((id): id is string => id != null)
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

  // The order module tracks its own ledger independently of the payment module
  await ctx.step('record-transaction', async ({ container }) => {
    const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
    await orderService.addOrderTransaction({
      orderId: order.id,
      amount: capturedPayment.payment.amount,
      currencyCode: capturedPayment.payment.currencyCode,
      reference: 'capture',
      referenceId: capturedPayment.payment.id,
    })
  })

  // Mark the cart as completed last — this is the point of no return for the storefront
  const completedCart = await ctx.step('complete-cart', async ({ container }) => {
    const cartService = container.resolve<ICartModuleService>(Modules.CART)
    return cartService.completeCart(input.cartId)
  })

  return completedCart
})

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
