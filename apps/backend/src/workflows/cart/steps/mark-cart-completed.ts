import { Modules } from '@core/utils/modules-definition.js'
import type { WorkflowContext } from '@core/workflows/types.js'

/**
 * Stamps `completedAt` so the Cart can't be modified or checked out again — that timestamp is the
 * Cart's only state. Shared by checkout and by turning a Cart into a Draft Order, which both close
 * the Cart the Order was made from.
 */
export async function markCartCompletedStep(ctx: WorkflowContext, input: { cartId: string }): Promise<void> {
  await ctx.step(
    'mark-cart-completed',
    async ({ container }) => {
      await container.resolve(Modules.CART).updateCart(input.cartId, { completedAt: new Date() })
    },
    async (_result, { container }) => {
      await container.resolve(Modules.CART).updateCart(input.cartId, { completedAt: null })
    },
  )
}
