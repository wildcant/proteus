import { ErrorTypes } from '@core/errors/app-error.js'
import type { CreateLineItemDTO } from '@core/types/cart/mutations.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { type WorkflowContext, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { buildListingSublines } from '../../product/utils/build-listing-subline.js'
import { buildVariantPrices } from '../../product/utils/build-variant-prices.js'
import { prepareLineItemData } from '../utils/prepare-line-item-data.js'

export const prepareLineItemsThrows = [ErrorTypes.INVALID_DATA, ErrorTypes.NOT_ALLOWED, ErrorTypes.NOT_FOUND] as const

export type PrepareLineItemsInput = {
  /** The currency the lines are priced in: the Cart's, or the Draft Order's. */
  currencyCode: string
  items: { variantId: string; quantity: number }[]
}

/**
 * Builds the lines a Cart or a Draft Order will store from what was picked, the way add-to-cart
 * builds them: shared so an item the admin adds to a draft is priced and titled exactly as the
 * shopper's own lines were.
 */
export async function prepareLineItemsStep(
  ctx: WorkflowContext,
  input: PrepareLineItemsInput,
): Promise<CreateLineItemDTO[]> {
  /**
   * Resolves each requested variant into the line item the cart will store: its catalogue
   * fields, and the price the shop is offering it at in the cart's currency. A variant the
   * catalogue cannot price in that currency is refused here rather than written at whatever
   * the caller suggested — the store's product routes drop unpriced variants for the same
   * reason, so one should never have been offered.
   */
  return ctx.step<CreateLineItemDTO[]>('prepare-line-items', async ({ container }) => {
    const productService = container.resolve(Modules.PRODUCT)
    const pricingService = container.resolve(Modules.PRICING)
    const linkService = container.resolve(ContainerRegistrationKeys.LINK)
    const storeService = container.resolve(Modules.STORE)

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
    const [products, groupings, store] = await Promise.all([
      productService.listProducts({ id: productIds }),
      productService.listProductGroupings(productIds),
      storeService.resolveStore(),
    ])
    const productById = new Map(products.map((product) => [product.id, product]))

    // The card's subline, from the template the list and the product page render it with — and
    // its fields only when the store has a template at all, as the list reads them.
    const card = store?.card ?? { subline: null, listSeparator: ', ' }
    const [fieldValuesByProductId, categories] = await Promise.all([
      card.subline ? productService.listFieldValuesOfProducts(productIds) : {},
      card.subline ? productService.listCategories() : [],
    ])
    const sublineByProductId = buildListingSublines(products, {
      card,
      typeByProductId: new Map(
        Object.entries(groupings).flatMap(([id, grouping]) => (grouping.type ? [[id, grouping.type.value]] : [])),
      ),
      fieldValuesByProductId,
      categories,
    })

    const links = await linkService.repo('productVariantPriceSet').findByVariantIds(variantIds)
    const priceSetIds = [...new Set(links.map((link) => link.priceSetId))]
    const calculatedPrices = await pricingService.calculatePrices(priceSetIds, {
      currencyCode: input.currencyCode,
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
          values: { variantId: variant.id, currencyCode: input.currencyCode },
        })
      }

      return prepareLineItemData({
        quantity: item.quantity,
        product,
        productType: groupings[product.id]?.type?.value ?? null,
        productSubline: sublineByProductId.get(product.id) ?? null,
        variant,
        unitPrice: price.calculatedAmount,
        compareAtUnitPrice: price.compareAtAmount,
        thumbnail: thumbnails.get(variant.id) ?? null,
      })
    })
  })
}
