import type { BigNumber } from '@core/db/bignum.js'
import type { CreateLineItemDTO } from '@core/types/cart/mutations.js'
import type { EnrichedProductVariantDTO, ProductDTO } from '@core/types/product/common.js'

/** The values separator the cart panel prints verbatim, e.g. `Black · S`. */
const OPTION_VALUE_SEPARATOR = ' · '

export type PrepareLineItemDataInput = {
  quantity: number
  product: ProductDTO
  variant: EnrichedProductVariantDTO
  unitPrice: BigNumber
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
    thumbnail: input.thumbnail,
    variantId: variant.id,
    variantSku: variant.sku,
    variantBarcode: variant.barcode,
    variantTitle: variant.title,
    // Values only, no option names — they are redundant next to a thumbnail of the thing. Empty
    // for a product with no options, which is stored as null rather than a blank line.
    variantOptionValues:
      variant.optionValues.map((optionValue) => optionValue.value).join(OPTION_VALUE_SEPARATOR) || null,
    productId: product.id,
    productTitle: product.title,
    productDescription: product.description,
    productSubtitle: product.subtitle,
    productHandle: product.handle,
    isGiftcard: product.isGiftcard,
    isDiscountable: product.discountable,
  }
}
