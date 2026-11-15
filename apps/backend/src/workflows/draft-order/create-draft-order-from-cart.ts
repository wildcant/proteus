import { ErrorTypes } from '@core/errors/app-error.js'
import type { OrderDTO } from '@core/types/order/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import {
  confirmLineItemsSellableStep,
  confirmLineItemsSellableThrows,
  type SellableLineItem,
} from '../cart/steps/confirm-line-items-sellable.js'
import { markCartCompletedStep } from '../cart/steps/mark-cart-completed.js'
import { buildOrderFromCart } from '../cart/utils/build-order-from-cart.js'

type CreateDraftOrderFromCartInput = { cartId: string }

/**
 * A Proteus addition, not in Medusa: the shopper sends a Cart to the shop as a Draft Order, for a
 * store that confirms orders with the shopper off-site. The Cart becomes a `draft` Order as it stands — its lines
 * with their options, its shipping address (phone included), its shipping method as stored, its
 * region, sales channel, currency, customer and email if any — and is closed in the same run, so
 * what the shopper sent can't drift from what the shop sees, and the storefront starts a new Cart.
 *
 * Sending the same Cart again answers the draft it already became, unchanged: the shop may have
 * edited it in the meantime, and nothing it agreed with the shopper is overwritten.
 *
 * Nothing is reserved and no payment is taken, so an abandoned conversation never holds stock; the stock
 * is checked here only so a line that can't be sold is refused, by name, before it reaches the shop.
 * No `order.placed` either: the Order is placed when the shop converts the draft.
 */
// TODO(locking): two concurrent first sends of one Cart both pass `check-existing-draft`; the
// `orderCart` unique index fails the second at `link-order-cart`, whose compensation removes its draft.
export const createDraftOrderFromCartWorkflow = createWorkflow<CreateDraftOrderFromCartInput, OrderDTO>(
  {
    name: 'create-draft-order-from-cart',
    throws: [...confirmLineItemsSellableThrows, ErrorTypes.CONFLICT, ErrorTypes.INVALID_DATA, ErrorTypes.NOT_ALLOWED],
  },
  async (ctx, input) => {
    /** The order this Cart already became, through the link that closes it. */
    const existingOrder = await ctx.step('check-existing-draft', async ({ container }) => {
      const link = await container.resolve(ContainerRegistrationKeys.LINK).repo('orderCart').findByCartId(input.cartId)
      if (!link) return null

      const cart = await container.resolve(Modules.CART).retrieveCart(input.cartId)
      /** A link without `completedAt` is another run still in flight — this one's twin, or a
       *  checkout — which closes the Cart a few steps later. Its Order may yet compensate away. */
      if (!cart.completedAt) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.CONFLICT,
          message: i18n.t('Cart "{cartId}" is already being completed'),
          values: { cartId: input.cartId },
        })
      }

      return container.resolve(Modules.ORDER).retrieveOrder(link.orderId)
    })

    if (existingOrder) return existingOrder

    /** A closed Cart is the record behind an Order and can't become another, and an empty one has
     *  nothing to send. */
    const lineItems = await ctx.step<SellableLineItem[]>('validate-cart', async ({ container }) => {
      const cartService = container.resolve(Modules.CART)
      const cart = await cartService.retrieveCart(input.cartId)
      if (cart.completedAt) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('Cart "{cartId}" is already completed'),
          values: { cartId: input.cartId },
        })
      }

      const lines = await cartService.listLineItems({ cartId: input.cartId })
      if (lines.length === 0) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: i18n.t('Cart "{cartId}" has no items'),
          values: { cartId: input.cartId },
        })
      }

      return lines.map(({ id, title, variantOptionValues, variantId, quantity }) => ({
        id,
        title,
        variantOptionValues,
        variantId,
        quantity,
      }))
    })

    await confirmLineItemsSellableStep(ctx, lineItems)

    /** The Cart as stored, shipping method included: its price is the one the shopper was shown. */
    const order = await ctx.step(
      'create-draft-order',
      async ({ container }) => {
        const cartService = container.resolve(Modules.CART)
        const [cart, addresses, cartLineItems, shippingMethods] = await Promise.all([
          cartService.retrieveCart(input.cartId),
          cartService.listCartAddresses({ cartId: input.cartId }),
          cartService.listLineItems({ cartId: input.cartId }),
          cartService.listShippingMethods({ cartId: input.cartId }),
        ])

        return container.resolve(Modules.ORDER).createOrder({
          ...buildOrderFromCart({ cart, email: cart.email, addresses, lineItems: cartLineItems, shippingMethods }),
          status: 'draft',
        })
      },
      async (createdOrder, { container }) => {
        await container.resolve(Modules.ORDER).softDeleteOrders([createdOrder.id])
      },
    )

    /** The link is what finds this draft again when the Cart is sent once more, and what
     *  checkout reads to refuse the Cart. `cartId` is unique, so a concurrent twin stops here. */
    await ctx.step(
      'link-order-cart',
      async ({ container }) => {
        await container
          .resolve(ContainerRegistrationKeys.LINK)
          .createMany([{ link: 'orderCart', data: { orderId: order.id, cartId: input.cartId } }])
      },
      async (_result, { container }) => {
        await container.resolve(ContainerRegistrationKeys.LINK).dismissLinks({ orderId: [order.id] })
      },
    )

    await markCartCompletedStep(ctx, { cartId: input.cartId })

    return order
  },
)
