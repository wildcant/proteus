import { ErrorTypes } from '@core/errors/app-error.js'
import type { PaymentSessionDTO } from '@core/types/payment/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'

type RepricePaymentSessionInput = { paymentCollectionId: string; sessionId: string }

/**
 * Re-prices an open payment session against the cart's current total, priced here and nowhere else.
 *
 * With deferred session creation the session is normally opened at the total it will be charged
 * at, so this is the exception rather than the rule — but the redirect return and the retry paths
 * can still arrive holding a session that predates a cart change, and this is what stops that
 * session charging the old basket.
 *
 * The browser supplies nothing but the two ids. `accept-a-payment` learned what happens otherwise
 * the expensive way: a hardcoded amount on the button over a server charging something else.
 */
export const repricePaymentSessionWorkflow = createWorkflow<RepricePaymentSessionInput, PaymentSessionDTO>(
  { name: 'reprice-payment-session', throws: [ErrorTypes.INVALID_DATA, ErrorTypes.NOT_ALLOWED, ErrorTypes.NOT_FOUND] },
  async (ctx, input) => {
    return ctx.step('reprice-payment-session', async ({ container }) => {
      const cartService = container.resolve(Modules.CART)
      const paymentService = container.resolve(Modules.PAYMENT)
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)

      const collection = await paymentService.retrievePaymentCollection(input.paymentCollectionId)
      const session = collection.paymentSessions?.find((candidate) => candidate.id === input.sessionId)

      // Checked against the collection the caller named rather than looked up on its own, so a
      // session id from another shopper's checkout cannot be re-priced through this route.
      if (!session) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_FOUND,
          message: i18n.t('Payment session "{sessionId}" is not part of payment collection "{collectionId}"'),
          values: { sessionId: input.sessionId, collectionId: collection.id },
        })
      }

      const link = await linkService.repo('cartPaymentCollection').findByPaymentCollectionId(collection.id)
      if (!link) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: i18n.t(
            'Payment collection "{collectionId}" is not linked to a cart, so it has no total to re-price against',
          ),
          values: { collectionId: collection.id },
        })
      }

      const cart = await cartService.retrieveCart(link.cartId)
      if (cart.completedAt) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('Cart "{cartId}" is already completed'),
          values: { cartId: link.cartId },
        })
      }

      const [lineItems, shippingMethods] = await Promise.all([
        cartService.listLineItems({ cartId: link.cartId }),
        cartService.listShippingMethods({ cartId: link.cartId }),
      ])
      const { cartTotal } = cartService.computeCartTotals({ lineItems, shippingMethods })

      // The gateway first, our own rows after. This step has no compensation because it needs
      // none in this order: a failed update at Stripe leaves the session and the collection both
      // standing at the total they were already agreed at.
      const updated = await paymentService.updatePaymentSession(session.id, {
        amount: cartTotal,
        currencyCode: cart.currencyCode,
      })

      // The collection moves with the session: its amount is what the module measures "authorized
      // in full" against, so leaving it at the old total would report a fully authorized
      // collection as partial.
      if (!cartTotal.isEqualTo(collection.amount)) {
        await paymentService.updatePaymentCollection(collection.id, { amount: cartTotal })
      }

      return updated
    })
  },
)
