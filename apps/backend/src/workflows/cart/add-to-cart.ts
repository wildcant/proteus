import { ErrorTypes } from '@core/errors/app-error.js'
import type { CartLineItemDTO } from '@core/types/cart/common.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { confirmVariantInventoryStep, confirmVariantInventoryThrows } from './steps/confirm-variant-inventory.js'
import { prepareLineItemsStep, prepareLineItemsThrows } from './steps/prepare-line-items.js'
import { refreshCartShippingMethodsStep } from './steps/refresh-cart-shipping-methods.js'
import { lineItemPlanDemands, planLineItemActions } from './utils/plan-line-item-actions.js'

/** What a shopper picks: which variant, and how many. Everything else is the catalogue's to say. */
type AddToCartItem = {
  variantId: string
  quantity: number
}

export type AddToCartInput = {
  cartId: string
  items: AddToCartItem[]
}

/**
 * Adds variants to a cart, merging each into the line it already has.
 *
 * Ported from Medusa's `add-to-cart` workflow, minus the parts that need infrastructure this
 * codebase does not have: price lists, tax lines, translations, sales-channel scoping and the
 * distributed lock. What survives is the shape that matters — the cart is validated, the line
 * item is built from the catalogue rather than from the request, an addition folds into the
 * existing line for that variant, and stock is confirmed against the quantity the cart would end
 * up holding rather than the quantity being added.
 *
 * TODO(locking): the write is atomic, but the read it is planned from is not part of it. Two
 * concurrent adds of the same variant both see a cart without that line and both create one,
 * leaving the duplicate this workflow exists to prevent. Medusa takes a lock on `cart_id` for
 * exactly this window; a unique index on `(cart_id, variant_id)` would close it from below.
 */
export const addToCartWorkflow = createWorkflow<AddToCartInput, CartLineItemDTO[]>(
  {
    name: 'add-to-cart',
    throws: [
      ...confirmVariantInventoryThrows,
      ...prepareLineItemsThrows,
      ErrorTypes.INVALID_DATA,
      ErrorTypes.NOT_ALLOWED,
    ],
  },
  async (ctx, input) => {
    /**
     * A completed cart is the record behind an order and must not grow, and an empty payload is
     * a caller bug rather than a no-op worth writing steps for.
     */
    const cart = await ctx.step('validate-cart', async ({ container }) => {
      if (input.items.length === 0) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: i18n.t('No items to add to the cart'),
        })
      }

      const cartService = container.resolve(Modules.CART)
      const cart = await cartService.retrieveCart(input.cartId)

      if (cart.completedAt) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('Cart "{cartId}" is already completed'),
          values: { cartId: input.cartId },
        })
      }

      return cart
    })

    const lineItems = await prepareLineItemsStep(ctx, { currencyCode: cart.currencyCode, items: input.items })

    /**
     * Which of the prepared items join a line the cart already holds, and which start one — and the
     * quantity each variant's line ends up at, which is what stock is confirmed against: raising a
     * line from one to five is confirmed at five, not at the four being added.
     */
    const planned = await ctx.step('plan-line-items', async ({ container }) => {
      const cartService = container.resolve(Modules.CART)
      const existing = await cartService.listLineItems({ cartId: cart.id })

      const plan = planLineItemActions(existing, lineItems)
      return { plan, demands: lineItemPlanDemands(plan) }
    })

    await confirmVariantInventoryStep(ctx, planned.demands)

    /**
     * The lines started and the lines raised are rows of one table in one module, so the cart module
     * writes them in a single transaction and the database puts a failure of this step back. The
     * compensation is for the shipping refresh after it: the started lines are removed and the raised
     * ones return to the quantity and price they held.
     */
    const written = await ctx.step(
      'write-line-items',
      async ({ container }) => {
        const cartService = container.resolve(Modules.CART)
        const mergedIds = planned.plan.merge.map((merge) => merge.id)
        const previous = mergedIds.length > 0 ? await cartService.listLineItems({ id: mergedIds, cartId: cart.id }) : []
        const lineItems = await cartService.applyLineItemPlan(cart.id, planned.plan)
        const mergedIdSet = new Set(mergedIds)

        return {
          lineItems,
          createdIds: lineItems.filter((item) => !mergedIdSet.has(item.id)).map((item) => item.id),
          previousLines: previous.map((item) => ({
            id: item.id,
            data: { quantity: item.quantity, unitPrice: item.unitPrice, compareAtUnitPrice: item.compareAtUnitPrice },
          })),
        }
      },
      async ({ createdIds, previousLines }, { container }) => {
        const cartService = container.resolve(Modules.CART)
        if (createdIds.length > 0) await cartService.softDeleteLineItems(createdIds)
        if (previousLines.length > 0) {
          await cartService.applyLineItemPlan(cart.id, { create: [], merge: previousLines })
        }
      },
    )

    await refreshCartShippingMethodsStep(ctx, { cartId: input.cartId })

    return written.lineItems
  },
)
