import { ErrorTypes } from '@core/errors/app-error.js'
import type { CartLineItemDTO } from '@core/types/cart/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { buildVariantPrices } from '../product/utils/build-variant-prices.js'
import { confirmVariantInventoryStep, confirmVariantInventoryThrows } from './steps/confirm-variant-inventory.js'
import { lineItemPlanDemands, planLineItemActions } from './utils/plan-line-item-actions.js'
import { prepareLineItemData } from './utils/prepare-line-item-data.js'

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
    throws: [...confirmVariantInventoryThrows, ErrorTypes.INVALID_DATA, ErrorTypes.NOT_ALLOWED, ErrorTypes.NOT_FOUND],
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

    /**
     * Resolves each requested variant into the line item the cart will store: its catalogue
     * fields, and the price the shop is offering it at in the cart's currency. A variant the
     * catalogue cannot price in that currency is refused here rather than written at whatever
     * the caller suggested — the store's product routes drop unpriced variants for the same
     * reason, so one should never have been offered.
     */
    const lineItems = await ctx.step('prepare-line-items', async ({ container }) => {
      const productService = container.resolve(Modules.PRODUCT)
      const pricingService = container.resolve(Modules.PRICING)
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)

      const variantIds = [...new Set(input.items.map((item) => item.variantId))]
      const variants = await productService.enrichVariants(await productService.listProductVariants({ id: variantIds }))
      const variantById = new Map(variants.map((variant) => [variant.id, variant]))

      const missing = variantIds.filter((variantId) => !variantById.has(variantId))
      if (missing.length) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_FOUND,
          message: i18n.t('Variant(s) not found: {missing}'),
          values: { missing: missing.join(', ') },
        })
      }

      const productIds = [...new Set(variants.map((variant) => variant.productId))]
      // The product rows are flat, so the Type's value comes through the batched groupings read.
      const [products, groupings] = await Promise.all([
        productService.listProducts({ id: productIds }),
        productService.listProductGroupings(productIds),
      ])
      const productById = new Map(products.map((product) => [product.id, product]))

      const links = await linkService.repo('productVariantPriceSet').findByVariantIds(variantIds)
      const priceSetIds = [...new Set(links.map((link) => link.priceSetId))]
      const calculatedPrices = await pricingService.calculatePrices(priceSetIds, {
        currencyCode: cart.currencyCode,
      })
      const priceByVariantId = buildVariantPrices(links, calculatedPrices)

      // One read per variant, and the ids are already deduplicated, so a repeat of the same
      // variant in the payload does not pay for it twice.
      const thumbnails = new Map(
        await Promise.all(
          variantIds.map(
            async (variantId) => [variantId, await productService.resolveVariantThumbnail(variantId)] as const,
          ),
        ),
      )

      return input.items.map((item) => {
        const variant = variantById.get(item.variantId)
        const product = variant ? productById.get(variant.productId) : undefined
        if (!variant || !product) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.NOT_FOUND,
            message: i18n.t('Variant "{variantId}" has no product'),
            values: { variantId: item.variantId },
          })
        }

        // The storefront only lists published products, so this is a caller reaching past the
        // catalogue rather than a shopper doing something ordinary.
        if (product.status !== 'published') {
          throw new WorkflowTerminalError({
            type: ErrorTypes.NOT_ALLOWED,
            message: i18n.t('Product "{productId}" is not available for sale'),
            values: { productId: product.id },
          })
        }

        const price = priceByVariantId.get(variant.id)
        if (!price) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.INVALID_DATA,
            message: i18n.t('Variant "{variantId}" has no price in {currencyCode}'),
            values: { variantId: variant.id, currencyCode: cart.currencyCode },
          })
        }

        return prepareLineItemData({
          quantity: item.quantity,
          product,
          productType: groupings[product.id]?.type?.value ?? null,
          variant,
          unitPrice: price.calculatedAmount,
          thumbnail: thumbnails.get(variant.id) ?? null,
        })
      })
    })

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
     * No compensation, and none needed: the lines started and the lines raised are rows of one
     * table in one module, so the cart module writes them in a single transaction and the
     * database is what puts a failure back. A compensating write could fail on its own.
     */
    return ctx.step('write-line-items', async ({ container }) => {
      const cartService = container.resolve(Modules.CART)
      return cartService.applyLineItemPlan(cart.id, planned.plan)
    })
  },
)
