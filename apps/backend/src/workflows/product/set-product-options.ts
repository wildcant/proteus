import type { ICartModuleService } from '@core/types/cart/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { IPricingModuleService } from '@core/types/pricing/service.js'
import type { AppliedProductOptionChangeDTO } from '@core/types/product/common.js'
import type { SetProductOptionsDTO } from '@core/types/product/mutations.js'
import type { IProductModuleService } from '@core/types/product/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow, type StepContext } from '@core/workflows/types.js'

type SetProductOptionsInput = { productId: string; data: SetProductOptionsDTO }

/**
 * Changes which options a product offers, and brings its variants along.
 *
 * A product's variants are derived from its options, so editing the options is not something to
 * refuse when variants exist — it is something the variant set has to follow. The plan is computed
 * inside the module, alongside the write it describes, and never leaves this workflow: the admin
 * has already consented to the destructive half from `variantCount`, and what actually happens is
 * whatever the data says at save time.
 *
 * The options and the variant moves they force are one step because they are one transaction —
 * every ordering of them passes through a state where a variant has no value for an option its
 * product offers. What is left here is only what the product module cannot do for itself: price
 * sets, links and carts. Removing comes last, so that a compensation unwinds the cheap steps first
 * and the irreversible one is attempted last.
 */
export const setProductOptionsWorkflow = createWorkflow<SetProductOptionsInput, void>(
  'set-product-options',
  async (ctx, input) => {
    // Step 1: remember what to put back, before anything moves
    const { previousOptions, previousCombinations } = await ctx.step('capture', async ({ container }) => {
      const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

      const scoped = await productService.listProductOptionsForProduct(input.productId)
      const variants = await productService.listProductVariants({ productId: input.productId })
      const maps = await productService.listVariantOptionMaps(variants.map((variant) => variant.id))

      return {
        previousOptions: {
          options: scoped.map((option) => ({
            optionId: option.id,
            valueIds: option.values.map((value) => value.id),
          })),
        } satisfies SetProductOptionsDTO,
        previousCombinations: variants.map((variant) => ({
          variantId: variant.id,
          optionValues: maps[variant.id] ?? {},
        })),
      }
    })

    // Step 2: the options, and every variant move they force, as one transaction
    const { plan, created } = await ctx.step(
      'apply-options',
      async ({ container }): Promise<AppliedProductOptionChangeDTO> => {
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        return productService.applyProductOptionChange(input.productId, input.data)
      },
      async (applied, { container }) => {
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        // Order matters: the options have to be back before a combination expressed in them can be.
        await productService.revertProductOptionChange(input.productId, previousOptions, previousCombinations)
        if (applied.created.length > 0) {
          await productService.softDeleteProductVariants(applied.created.map((variant) => variant.id))
        }
      },
    )

    // Step 3: copy each new variant's price from the survivor it shares most option values with
    await ctx.step('copy-prices', async ({ container }) => {
      if (created.length === 0) return
      const sources = plan.create.map((entry) => entry.copyPricesFromVariantId)
      if (sources.every((source) => source === null)) return

      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)

      const sourceIds = [...new Set(sources.filter((source): source is string => source !== null))]
      const sourceLinks = await linkService.repo('productVariantPriceSet').findByVariantIds(sourceIds)
      const priceSetIdByVariantId = new Map(sourceLinks.map((link) => [link.variantId, link.priceSetId]))

      // Each created variant gets its own price set and link, so the copies do not depend on one
      // another. Sharing a source only means reading the same prices twice, never a write conflict.
      await Promise.all(
        created.map(async (variant, index) => {
          const sourcePriceSetId = priceSetIdByVariantId.get(sources[index] ?? '')
          if (!sourcePriceSetId) return

          const prices = await pricingService.listPrices({ priceSetId: sourcePriceSetId })
          if (prices.length === 0) return

          const [priceSet] = await pricingService.createPriceSets([
            { prices: prices.map((price) => ({ currencyCode: price.currencyCode, amount: price.amount })) },
          ])
          if (!priceSet) return

          await linkService.repo('productVariantPriceSet').create({ variantId: variant.id, priceSetId: priceSet.id })
        }),
      )
    })

    // Step 4: variants the change leaves no room for
    await ctx.step(
      'remove-variants',
      async ({ container }) => {
        if (plan.remove.length === 0) return
        const variantIds = plan.remove.map((entry) => entry.variantId)

        const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
        const dismissed = await linkService.dismissLinks({ variantId: variantIds })

        const dismissedPriceSetLinks = dismissed.productVariantPriceSet ?? []
        if (dismissedPriceSetLinks.length > 0) {
          const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
          await pricingService.softDeletePriceSets(dismissedPriceSetLinks.map((link) => link.priceSetId))
        }

        await evictFromActiveCarts(container, variantIds)

        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.softDeleteProductVariants(variantIds)
      },
      // Nothing to put back: a compensation only runs when a *later* step fails, and this is last.
      async () => undefined,
    )
  },
)

/**
 * Drops a removed variant's line items from carts still being shopped.
 *
 * Silently, the way Shopify does — a shopper who never sees the line does not need telling it left.
 * Completed carts are the record behind an order and stay intact; the order's own line items are a
 * separate table with their own copies, so history is unaffected either way.
 */
async function evictFromActiveCarts(container: StepContext['container'], variantIds: string[]): Promise<void> {
  const cartService = container.resolve<ICartModuleService>(Modules.CART)

  const lineItems = await cartService.listLineItems({ variantId: variantIds })
  if (lineItems.length === 0) return

  const carts = await cartService.listCarts({
    id: [...new Set(lineItems.map((item) => item.cartId))],
    completedAt: null,
  })
  const activeCartIds = new Set(carts.map((cart) => cart.id))

  const doomed = lineItems.filter((item) => activeCartIds.has(item.cartId)).map((item) => item.id)
  if (doomed.length > 0) await cartService.softDeleteLineItems(doomed)
}
