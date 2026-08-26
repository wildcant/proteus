import type { CreateProduct, CreateProductVariant } from '../../../src/schema.js'
import {
  createProductOption,
  createProductOptionValue,
  createProductProductOption,
  createProductProductOptionValue,
  createProductVariantOption,
  deleteProductOptionById,
  deleteProductProductOptionById,
  deleteProductProductOptionValueById,
  deleteProductVariantOptionById,
} from './product-option.js'
import { createProductWithPricing } from './product-with-pricing.js'

type CreateProductWithOptionOptions = {
  product?: Partial<CreateProduct>
  variant?: Partial<CreateProductVariant>
  price?: { amount: string; currencyCode?: string }
  /** The option's own title is suffixed with the product id; this is the leading part of it. */
  optionTitle?: string
  optionValue?: string
}

/**
 * A priced product offering exactly one option with one value, wired all the way through to the
 * variant — so a PDP renders a picker and the variant is reachable by selecting from it.
 *
 * Builds on `createProductWithPricing`, since a product with no price is dropped from the store
 * routes entirely and the picker would have nothing to select.
 *
 * The option's title carries the product id because product options are globally unique by
 * title: two tests creating `Colour` at the same time collide, and specs run in parallel.
 */
export async function createProductWithOption(options: CreateProductWithOptionOptions = {}) {
  const product = await createProductWithPricing({
    product: options.product,
    variant: options.variant,
    price: options.price ?? { amount: '25.00' },
  })

  const option = await createProductOption({
    title: `${options.optionTitle ?? 'Colour'}-${product.id}`,
    renderAs: 'text',
  })
  const optionValue = await createProductOptionValue({
    optionId: option.id,
    value: options.optionValue ?? 'Onyx',
    rank: 0,
  })
  const productOption = await createProductProductOption({
    productId: product.id,
    optionId: option.id,
    rank: 0,
  })
  const offered = await createProductProductOptionValue({
    productProductOptionId: productOption.id,
    optionValueId: optionValue.id,
  })
  const variantOption = await createProductVariantOption({
    variantId: product.variant.id,
    productProductOptionValueId: offered.id,
  })

  return {
    ...product,
    option,
    optionValue,
    [Symbol.asyncDispose]: async () => {
      await deleteProductVariantOptionById(variantOption.id)
      await deleteProductProductOptionValueById(offered.id)
      await deleteProductProductOptionById(productOption.id)
      await product[Symbol.asyncDispose]()
      // The option value cascades from its option.
      await deleteProductOptionById(option.id)
    },
  }
}
