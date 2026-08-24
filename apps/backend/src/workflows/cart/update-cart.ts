import { ErrorTypes } from '@core/errors/app-error.js'
import type { CartDTO } from '@core/types/cart/common.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import type { UpdateCartBody } from '@proteus/http-schemas/store'
import { findOrCreateCustomerStep } from './steps/find-or-create-customer.js'

type UpdateCartInput = UpdateCartBody & {
  cartId: string
}

export const updateCartWorkflow = createWorkflow<UpdateCartInput, CartDTO>('update-cart', async (ctx, input) => {
  /**
   * Validates the cart exists and hasn't been completed. A completed cart is the record behind
   * an order and must not accept further updates.
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
  })

  /**
   * When a guest provides an email, find or create a guest customer record
   * and link it to the cart so the order inherits a customerId.
   */
  const { customer } = await findOrCreateCustomerStep(ctx, {
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
  })

  /**
   * Links the guest customer to the cart, then upserts addresses and email
   * in a single transaction.
   */
  const updatedCart = await ctx.step('update-cart', async ({ container }) => {
    const cartService = container.resolve<ICartModuleService>(Modules.CART)

    if (customer) {
      await cartService.updateCart(input.cartId, { customerId: customer.id, email: customer.email })
    }

    return cartService.updateCartWithAddresses(input.cartId, {
      email: input.email,
      shippingAddress: input.shippingAddress,
      billingAddress: input.billingAddress,
    })
  })

  return updatedCart
})
