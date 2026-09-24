import { ErrorTypes } from '@core/errors/app-error.js'
import type { PaymentCollectionDTO } from '@core/types/payment/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'

type CreatePaymentCollectionForCartInput = { cartId: string }

export const createPaymentCollectionForCartWorkflow = createWorkflow<
  CreatePaymentCollectionForCartInput,
  PaymentCollectionDTO
>(
  { name: 'create-payment-collection-for-cart', throws: [ErrorTypes.INVALID_DATA, ErrorTypes.NOT_ALLOWED] },
  async (ctx, input) => {
    const paymentCollection = await ctx.step(
      'create-payment-collection',
      async ({ container }) => {
        const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
        const cartService = container.resolve(Modules.CART)
        const paymentService = container.resolve(Modules.PAYMENT)
        const linkService = container.resolve(ContainerRegistrationKeys.LINK)

        // Validate cart exists and has no existing payment collection
        const cart = await cartService.retrieveCart(input.cartId)

        if (cart.completedAt) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.NOT_ALLOWED,
            message: i18n.t('Cart "{cartId}" is already completed'),
            values: { cartId: input.cartId },
          })
        }

        const existingLink = await linkService.repo('cartPaymentCollection').findByCartId(input.cartId)
        if (existingLink) {
          return paymentService.retrievePaymentCollection(existingLink.paymentCollectionId)
        }

        // Compute cart total from line items + shipping
        const [lineItems, shippingMethods] = await Promise.all([
          cartService.listLineItems({ cartId: input.cartId }),
          cartService.listShippingMethods({ cartId: input.cartId }),
        ])
        const { cartTotal: amount } = cartService.computeCartTotals({ lineItems, shippingMethods })

        if (amount.isLessThanOrEqualTo(0)) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.INVALID_DATA,
            message: i18n.t('Cart "{cartId}" has no items or zero total'),
            values: { cartId: input.cartId },
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
        const paymentService = container.resolve(Modules.PAYMENT)
        await paymentService.softDeletePaymentCollections([collection.id])
      },
    )

    return paymentCollection
  },
)
