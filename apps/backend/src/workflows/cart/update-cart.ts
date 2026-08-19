import { ErrorTypes } from '@core/errors/app-error.js'
import type { CartAddressDTO, CartDTO } from '@core/types/cart/common.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import type { Logger } from '@core/types/logger.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import type { UpdateCartBody } from '@proteus/http-schemas/store'

type UpdateCartInput = UpdateCartBody & {
  cartId: string
}

type UpsertedAddress = {
  addressId: string
  previousAddress: CartAddressDTO | null
}

type UpsertAddressesResult = {
  shippingAddressId: string | null
  billingAddressId: string | null
  shipping: UpsertedAddress | null
  billing: UpsertedAddress | null
}

export const updateCartWorkflow = createWorkflow<UpdateCartInput, CartDTO>('update-cart', async (ctx, input) => {
  const existingCart = await ctx.step('validate-cart', async ({ container }) => {
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

    return cart
  })

  const addresses = await ctx.step(
    'upsert-addresses',
    async ({ container }): Promise<UpsertAddressesResult> => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)

      let shipping: UpsertedAddress | null = null
      if (input.shippingAddress) {
        const previousAddress = existingCart.shippingAddressId
          ? await cartService.retrieveCartAddress(existingCart.shippingAddressId)
          : null
        const address = await cartService.upsertCartAddress(existingCart.shippingAddressId, input.shippingAddress)
        shipping = { addressId: address.id, previousAddress }
      }

      let billing: UpsertedAddress | null = null
      if (input.billingAddress) {
        const previousAddress = existingCart.billingAddressId
          ? await cartService.retrieveCartAddress(existingCart.billingAddressId)
          : null
        const address = await cartService.upsertCartAddress(existingCart.billingAddressId, input.billingAddress)
        billing = { addressId: address.id, previousAddress }
      }

      return {
        shippingAddressId: shipping?.addressId ?? existingCart.shippingAddressId,
        billingAddressId: billing?.addressId ?? existingCart.billingAddressId,
        shipping,
        billing,
      }
    },
    async (result, { container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)

      for (const upserted of [result.shipping, result.billing]) {
        if (!upserted) continue
        if (upserted.previousAddress) {
          const { id, createdAt, updatedAt, deletedAt, ...addressData } = upserted.previousAddress
          await cartService.updateCartAddress(upserted.addressId, addressData)
        } else {
          await cartService.deleteCartAddresses([upserted.addressId])
        }
      }
    },
  )

  const updatedCart = await ctx.step(
    'update-cart',
    async ({ container }) => {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
      const cartService = container.resolve<ICartModuleService>(Modules.CART)

      logger.debug(`[update-cart] Updating cart "${input.cartId}"`)

      // TODO(guest): when a guest provides an email, findOrCreateCustomer by email
      // and set customerId on the cart so the order inherits it
      return cartService.updateCart(input.cartId, {
        ...(input.email !== undefined ? { email: input.email } : {}),
        shippingAddressId: addresses.shippingAddressId,
        billingAddressId: addresses.billingAddressId,
      })
    },
    async (_updatedCart, { container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      await cartService.updateCart(input.cartId, {
        email: existingCart.email,
        shippingAddressId: existingCart.shippingAddressId,
        billingAddressId: existingCart.billingAddressId,
      })
    },
  )

  return updatedCart
})
