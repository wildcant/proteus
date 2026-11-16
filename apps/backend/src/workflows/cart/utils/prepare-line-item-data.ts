import type { BigNumber } from '@core/bignumber.js'
import type { CreateLineItemDTO } from '@core/types/cart/mutations.js'
import type { EnrichedProductVariantDTO, ProductDTO } from '@core/types/product/common.js'

/** The values separator the cart panel prints verbatim, e.g. `Black · S`. */
const OPTION_VALUE_SEPARATOR = ' · '

export type PrepareLineItemDataInput = {
  quantity: number
  product: ProductDTO
  /** The value of the product's live Product Type, or `null` when it has none. */
  productType: string | null
  /** The product card's subline as the store's template renders it, or `null` when it renders none. */
  productSubline: string | null
  variant: EnrichedProductVariantDTO
  unitPrice: BigNumber
  /** The price's compare-at when it marks the variant down, else `null`. */
  compareAtUnitPrice: BigNumber | null
  thumbnail: string | null
}

/**
 * The snapshot a cart keeps of what was bought.
 *
 * Every field is copied off the catalogue rather than taken from the request: a line item is the
 * shop's record of the sale, so a payload that could name its own title or price would be naming
 * the terms of it. The columns are frozen at add time on purpose — a product renamed tomorrow
 * must not silently rewrite what a shopper put in their bag today.
 */
export function prepareLineItemData(input: PrepareLineItemDataInput): CreateLineItemDTO {
  const { product, variant } = input

  return {
    // The product's name, not the variant's: it is what the cart panel prints as the line's
    // title, with the option values below it as the spec.
    title: product.title,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    compareAtUnitPrice: input.compareAtUnitPrice,
    thumbnail: input.thumbnail,
    variantId: variant.id,
    variantSku: variant.sku,
    variantBarcode: variant.barcode,
    variantTitle: variant.title,
    // Values only, no option names — they are redundant next to a thumbnail of the thing. Empty
    // for a product with no options, which is stored as null rather than a blank line.
    variantOptionValues:
      variant.optionValues.map((optionValue) => optionValue.value).join(OPTION_VALUE_SEPARATOR) || null,
    // The same values with their option's title, for a surface that has to say which value is the
    // size — the cart line's «Talla 41 · Negro y Crema», and the order message built from it.
    variantOptions: variant.optionValues.map(({ optionTitle, renderAs, value }) => ({ optionTitle, renderAs, value })),
    productId: product.id,
    productTitle: product.title,
    productDescription: product.description,
    productSubtitle: product.subtitle,
    productHandle: product.handle,
    productType: input.productType,
    productSubline: input.productSubline,
    isGiftcard: product.isGiftcard,
    isDiscountable: product.discountable,
  }
}
