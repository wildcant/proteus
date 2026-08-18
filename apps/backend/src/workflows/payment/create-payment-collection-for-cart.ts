import { BigNumber } from '@core/db/bignum.js'
import { ErrorTypes } from '@core/errors/app-error.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { Logger } from '@core/types/logger.js'
import type { PaymentCollectionDTO } from '@core/types/payment/common.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'

type CreatePaymentCollectionForCartInput = { cartId: string }

export const createPaymentCollectionForCartWorkflow = createWorkflow<
  CreatePaymentCollectionForCartInput,
  PaymentCollectionDTO
>('create-payment-collection-for-cart', async (ctx, input) => {
  const paymentCollection = await ctx.step(
    'create-payment-collection',
    async ({ container }) => {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

      // Validate cart exists and has no existing payment collection
      const cart = await cartService.retrieveCart(input.cartId)

      if (cart.completedAt) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cart "${input.cartId}" is already completed`,
        })
      }

      const existingLink = await linkService.repo('cartPaymentCollection').findByCartId(input.cartId)
      if (existingLink) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.CONFLICT,
          message: `Cart "${input.cartId}" already has a payment collection`,
        })
      }

      // Compute cart total from line items + shipping
      const [lineItems, shippingMethods] = await Promise.all([
        cartService.listLineItems({ cartId: input.cartId }),
        cartService.listShippingMethods({ cartId: input.cartId }),
      ])
      const lineItemTotal = lineItems.reduce(
        (sum, li) => sum.plus(li.unitPrice.multipliedBy(li.quantity)),
        new BigNumber(0),
      )
      const shippingTotal = shippingMethods.reduce((sum, sm) => sum.plus(sm.amount), new BigNumber(0))
      const amount = lineItemTotal.plus(shippingTotal)

      if (amount.isLessThanOrEqualTo(0)) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: `Cart "${input.cartId}" has no items or zero total`,
        })
      }

      logger.debug(
        `[create-payment-collection-for-cart] Creating collection for cart "${input.cartId}" with amount ${amount}`,
      )

      const collection = await paymentService.createPaymentCollection({
        amount,
        currencyCode: cart.currencyCode,
      })

      await linkService.repo('cartPaymentCollection').create({
        cartId: input.cartId,
        paymentCollectionId: collection.id,
      })

      return collection
    },
    async (collection, { container }) => {
      const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)
      await paymentService.deletePaymentCollections([collection.id])
    },
  )

  return paymentCollection
})
