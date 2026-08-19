import { faker } from '@faker-js/faker'
import { BigNumber } from '../../../src/core/db/bignum.js'
import type { CreateProduct, CreateProductVariant } from '../../../src/schema.js'
import {
  createPrice,
  createPriceSet,
  createProductVariantPriceSet,
  deletePriceSetById,
  deleteProductVariantPriceSetById,
} from './pricing.js'
import { createProduct, deleteProductById } from './product.js'
import { createProductVariant } from './product-variant.js'

type CreateProductWithPricingOptions = {
  product?: Partial<CreateProduct>
  variant?: Partial<CreateProductVariant>
  price?: { amount: string; currencyCode?: string }
}

export async function createProductWithPricing(options: CreateProductWithPricingOptions = {}) {
  const product = await createProduct({ status: 'published', ...options.product })
  const variant = await createProductVariant({ productId: product.id, ...options.variant })
  const priceSet = await createPriceSet()

  const amount = options.price?.amount ?? faker.commerce.price({ min: 5, max: 200 })
  const currencyCode = options.price?.currencyCode ?? 'usd'

  await createPrice({
    priceSetId: priceSet.id,
    amount: new BigNumber(amount),
    currencyCode,
  })

  const link = await createProductVariantPriceSet({
    variantId: variant.id,
    priceSetId: priceSet.id,
  })

  return {
    ...product,
    variant,
    priceSet,
    amount,
    currencyCode,
    [Symbol.asyncDispose]: async () => {
      await deleteProductVariantPriceSetById(link.id)
      // price cascades from price_set deletion
      await deletePriceSetById(priceSet.id)
      // variant cascades from product deletion
      await deleteProductById(product.id)
    },
  }
}
