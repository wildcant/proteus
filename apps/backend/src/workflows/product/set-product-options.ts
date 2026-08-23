import type { ICartModuleService } from '@core/types/cart/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { IPricingModuleService } from '@core/types/pricing/service.js'
import type { ProductVariantDTO } from '@core/types/product/common.js'
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
 * before anything is written and never leaves this workflow: the admin has already consented to the
 * destructive half from `variantCount`, and what actually happens is whatever the data says at save
 * time.
 *
 * Creating and reassigning come before removing so that a compensation unwinds the cheap steps
 * first and the irreversible one is attempted last.
 */
export const setProductOptionsWorkflow = createWorkflow<SetProductOptionsInput, void>(
  'set-product-options',
  async (ctx, input) => {
    // Step 1: work out what the change does, and remember what to put back
    const { plan, previousOptions, previousCombinations } = await ctx.step('plan', async ({ container }) => {
      const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

      const scoped = await productService.listProductOptionsForProduct(input.productId)
      const variants = await productService.listProductVariants({ productId: input.productId })
      const maps = await productService.listVariantOptionMaps(variants.map((variant) => variant.id))

      return {
        plan: await productService.planProductOptionChange(input.productId, input.data),
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

    // Step 2: the option links themselves
    await ctx.step(
      'set-options',
      async ({ container }) => {
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.setProductOptions(input.productId, input.data)
      },
      async (_result, { container }) => {
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.setProductOptions(input.productId, previousOptions)
      },
    )

    // Step 3: variants that survive but stand for a different combination now
    await ctx.step(
      'reassign-variants',
      async ({ container }) => {
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.applyVariantReassignments(
          plan.reassign.map((entry) => ({
            variantId: entry.variantId,
            optionValues: entry.combination.optionValues,
          })),
        )
      },
      async (_result, { container }) => {
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.applyVariantReassignments(previousCombinations)
      },
    )

    // Step 4: the combinations nothing covers yet, priced from the nearest survivor
    const created = await ctx.step(
      'create-variants',
      async ({ container }): Promise<ProductVariantDTO[]> => {
        if (plan.create.length === 0) return []
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        return productService.createProductVariants(
          plan.create.map((entry) => ({
            productId: input.productId,
            optionValues: entry.combination.optionValues,
          })),
        )
      },
      async (variants, { container }) => {
        if (variants.length === 0) return
        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.deleteProductVariants(variants.map((variant) => variant.id))
      },
    )

    // Step 5: copy each new variant's price from the survivor it shares most option values with
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

    // Step 6: variants the change leaves no room for
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
          await pricingService.deletePriceSets(dismissedPriceSetLinks.map((link) => link.priceSetId))
        }

        await evictFromActiveCarts(container, variantIds)

        const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)
        await productService.deleteProductVariants(variantIds)
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
    status: 'active',
  })
  const activeCartIds = new Set(carts.map((cart) => cart.id))

  const doomed = lineItems.filter((item) => activeCartIds.has(item.cartId)).map((item) => item.id)
  if (doomed.length > 0) await cartService.deleteLineItems(doomed)
}
