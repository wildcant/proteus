import { ErrorTypes } from '@core/errors/app-error.js'
import type { CartDTO } from '@core/types/cart/common.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import type { ICustomerModuleService } from '@core/types/customer/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'

type TransferCartCustomerInput = { cartId: string; customerId: string }

// TODO(locking): No distributed lock — concurrent calls could race. Add acquireLock/releaseLock once available.
export const transferCartCustomerWorkflow = createWorkflow<TransferCartCustomerInput, CartDTO>(
  'transfer-cart-customer',
  async (ctx, input) => {
    return ctx.step<CartDTO>('transfer-cart', async ({ container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)

      const [cart, customer] = await Promise.all([
        cartService.retrieveCart(input.cartId),
        customerService.retrieveCustomer(input.customerId).catch(() => {
          throw new WorkflowTerminalError({
            type: ErrorTypes.NOT_FOUND,
            message: `Customer with id "${input.customerId}" not found`,
          })
        }),
      ])

      if (cart.customerId === customer.id) {
        return cart
      }

      return cartService.updateCart(input.cartId, {
        customerId: customer.id,
        email: customer.email,
      })
    })
  },
)
