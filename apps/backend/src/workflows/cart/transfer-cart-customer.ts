import { ErrorTypes } from '@core/errors/app-error.js'
import type { CartDTO } from '@core/types/cart/common.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'

type TransferCartCustomerInput = { cartId: string; customerId: string }

// TODO(locking): No distributed lock — concurrent calls could race. Add acquireLock/releaseLock once available.
export const transferCartCustomerWorkflow = createWorkflow<TransferCartCustomerInput, CartDTO>(
  { name: 'transfer-cart-customer', throws: [ErrorTypes.NOT_FOUND] },
  async (ctx, input) => {
    return ctx.step<CartDTO>('transfer-cart', async ({ container }) => {
      const cartService = container.resolve(Modules.CART)
      const customerService = container.resolve(Modules.CUSTOMER)

      const [cart, customer] = await Promise.all([
        cartService.retrieveCart(input.cartId),
        customerService.retrieveCustomer(input.customerId).catch(() => {
          throw new WorkflowTerminalError({
            type: ErrorTypes.NOT_FOUND,
            message: i18n.t('Customer with id "{customerId}" not found'),
            values: { customerId: input.customerId },
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
