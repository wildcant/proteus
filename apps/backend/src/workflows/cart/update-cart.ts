import { ErrorTypes } from '@core/errors/app-error.js'
import type { CartDTO } from '@core/types/cart/common.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import type { UpdateCartBody } from '@proteus/http-schemas/store'

type UpdateCartInput = UpdateCartBody & {
  cartId: string
}

export const updateCartWorkflow = createWorkflow<UpdateCartInput, CartDTO>('update-cart', async (ctx, input) => {
  /**
   * Validates the cart exists, hasn't been completed, and is in an active state.
   * A completed or inactive cart must not accept further updates — doing so could
   * corrupt an in-flight or finished order.
   */
  await ctx.step('validate-cart', async ({ container }) => {
    const cartService = container.resolve<ICartModuleService>(Modules.CART)
    const cart = await cartService.retrieveCart(input.cartId)

    if (cart.completedAt) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Cart "${input.cartId}" is already completed`,
      })
    }

    if (cart.status !== 'active') {
      throw new WorkflowTerminalError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Cart "${input.cartId}" is not active (status: ${cart.status})`,
      })
    }
  })

  /**
   * Upserts addresses and updates the cart in a single transaction. Address
   * entities are created or updated first, then linked to the cart along with
   * any email change. If anything fails, the entire transaction rolls back —
   * no manual compensation needed.
   */
  // TODO(guest): when a guest provides an email, findOrCreateCustomer by email
  // and set customerId on the cart so the order inherits it
  const updatedCart = await ctx.step('update-cart', async ({ container }) => {
    const cartService = container.resolve<ICartModuleService>(Modules.CART)

    return cartService.updateCartWithAddresses(input.cartId, {
      email: input.email,
      shippingAddress: input.shippingAddress,
      billingAddress: input.billingAddress,
    })
  })

  return updatedCart
})
