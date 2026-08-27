import { ErrorTypes } from '@core/errors/app-error.js'
import type { CartLineItemDTO } from '@core/types/cart/common.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { Logger } from '@core/types/logger.js'
import type { IPricingModuleService } from '@core/types/pricing/service.js'
import type { IProductModuleService } from '@core/types/product/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { buildVariantPrices } from '../product/utils/build-variant-prices.js'
import { planLineItemActions } from './utils/plan-line-item-actions.js'
import { prepareLineItemData } from './utils/prepare-line-item-data.js'
import { prepareVariantInventoryChecks } from './utils/variant-inventory.js'

/** What a shopper picks: which variant, and how many. Everything else is the catalogue's to say. */
export type AddToCartItem = {
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
  'add-to-cart',
  async (ctx, input) => {
    /**
     * A completed cart is the record behind an order and must not grow, and an empty payload is
     * a caller bug rather than a no-op worth writing steps for.
     */
    const cart = await ctx.step('validate-cart', async ({ container }) => {
      if (input.items.length === 0) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: 'No items to add to the cart',
        })
      }

      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const cart = await cartService.retrieveCart(input.cartId)

      if (cart.completedAt) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cart "${input.cartId}" is already completed`,
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
      const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
      const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

      const variantIds = [...new Set(input.items.map((item) => item.variantId))]
      const variants = await productService.enrichVariants(await productService.listProductVariants({ id: variantIds }))
      const variantById = new Map(variants.map((variant) => [variant.id, variant]))

      const missing = variantIds.filter((variantId) => !variantById.has(variantId))
      if (missing.length) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_FOUND,
          message: `Variant(s) not found: ${missing.join(', ')}`,
        })
      }

      const productIds = [...new Set(variants.map((variant) => variant.productId))]
      const products = await productService.listProducts({ id: productIds })
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
            message: `Variant "${item.variantId}" has no product`,
          })
        }

        // The storefront only lists published products, so this is a caller reaching past the
        // catalogue rather than a shopper doing something ordinary.
        if (product.status !== 'published') {
          throw new WorkflowTerminalError({
            type: ErrorTypes.NOT_ALLOWED,
            message: `Product "${product.id}" is not available for sale`,
          })
        }

        const price = priceByVariantId.get(variant.id)
        if (!price) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.INVALID_DATA,
            message: `Variant "${variant.id}" has no price in ${cart.currencyCode}`,
          })
        }

        return prepareLineItemData({
          quantity: item.quantity,
          product,
          variant,
          unitPrice: price.calculatedAmount,
          thumbnail: thumbnails.get(variant.id) ?? null,
        })
      })
    })

    /** Which of the prepared items join a line the cart already holds, and which start one. */
    const plan = await ctx.step('plan-line-items', async ({ container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const existing = await cartService.listLineItems({ cartId: cart.id })

      return planLineItemActions(existing, lineItems)
    })

    /**
     * Confirms the cart could actually be fulfilled once the addition lands. Checked against the
     * post-merge quantity, so raising a line from one to five is confirmed at five — the number
     * the shopper would be holding, not the four being added.
     */
    await ctx.step('confirm-inventory', async ({ container }) => {
      const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)

      const demands = [
        ...plan.create.flatMap((item) =>
          item.variantId ? [{ variantId: item.variantId, quantity: item.quantity }] : [],
        ),
        ...plan.merge.flatMap((entry) =>
          entry.data.quantity === undefined ? [] : [{ variantId: entry.variantId, quantity: entry.data.quantity }],
        ),
      ]

      const variantIds = demands.map((demand) => demand.variantId)
      const mappings = await linkService.repo('productVariantInventoryItem').findByVariantIds(variantIds)
      const inventoryItemIds = [...new Set(mappings.map((mapping) => mapping.inventoryItemId))]
      const levels = await inventoryService.listInventoryLevels({ inventoryItemId: inventoryItemIds })

      const checks = prepareVariantInventoryChecks(demands, mappings, levels)
      if (!checks.length) {
        // A variant with no inventory item behind it is not stock-managed, which is what the
        // storefront already treats as buyable.
        logger.debug('[add-to-cart] No stock-managed variants in the addition, skipping')
        return
      }

      const covered = await Promise.all(
        checks.map(async (check) => {
          const required = check.quantity * check.requiredQuantity
          const hasCoverage = await inventoryService.confirmInventory(
            check.inventoryItemId,
            check.locationIds,
            required,
          )
          logger.debug(`[add-to-cart] Variant ${check.variantId}: need ${required}, covered=${hasCoverage}`)
          return hasCoverage
        }),
      )

      if (covered.some((hasCoverage) => !hasCoverage)) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.CONFLICT,
          message: 'Not enough stock to add the requested quantity',
        })
      }
    })

    /**
     * No compensation, and none needed: the lines started and the lines raised are rows of one
     * table in one module, so the cart module writes them in a single transaction and the
     * database is what puts a failure back. A compensating write could fail on its own.
     */
    return ctx.step('write-line-items', async ({ container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      return cartService.applyLineItemPlan(cart.id, plan)
    })
  },
)
