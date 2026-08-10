import { ErrorTypes } from '@core/errors/app-error.js'
import type { CartDTO } from '@core/types/cart/common.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { Logger } from '@core/types/logger.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'

type CompleteCartInput = { cartId: string }

export const completeCartWorkflow = createWorkflow<CompleteCartInput, CartDTO>('complete-cart', async (ctx, input) => {
  // Validate shipping method is selected and still valid
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

  const cart = await ctx.step('authorize-and-complete', async ({ container }) => {
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
    const cartService = container.resolve<ICartModuleService>(Modules.CART)
    const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
    const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

    const existingCart = await cartService.retrieveCart(input.cartId)
    if (existingCart.status !== 'active') {
      throw new WorkflowTerminalError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Cart "${input.cartId}" is not active (status: ${existingCart.status})`,
      })
    }

    const link = await linkService.repo('cartPaymentCollection').findByCartId(input.cartId)
    if (!link) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.INVALID_DATA,
        message: `Cart "${input.cartId}" has no payment collection`,
      })
    }

    const collection = await paymentService.retrievePaymentCollection(link.paymentCollectionId)
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
    await paymentService.capturePayment({ paymentId: payment.id, amount: collection.amount })

    // TODO: [orders] Create an order from the cart data before marking complete
    // When the order module is added, add steps here:
    //   - Transform cart + line items + shipping into an order
    //   - Create order via orderService.createOrders([orderData])
    //   - Link order to cart (order_cart link)
    //   - Link order to payment collection
    //   - Reserve inventory for each line item
    //   - Record order transactions from payment captures

    const completedCart = await cartService.completeCart(input.cartId)
    return completedCart
  })

  return cart
})
