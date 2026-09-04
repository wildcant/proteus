import { faker } from '@faker-js/faker'
import { BigNumber } from '../../../src/core/bignumber.js'
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

type PriceOverride = { amount: string; currencyCode?: string }

type CreateProductWithPricingOptions = {
  product?: Partial<CreateProduct>
  variant?: Partial<CreateProductVariant>
  /** The single-currency shorthand, and what almost every caller wants. */
  price?: PriceOverride
  /**
   * One price per currency the variant is sold in, on one price set.
   *
   * A store selling in more than one market prices the same variant in each of their currencies,
   * and which one a request is quoted is the region's decision, not the catalogue's — so a spec
   * that asserts a market shows its own money needs the other currency to exist and to be a
   * different number. Takes precedence over `price` when both are given.
   */
  prices?: PriceOverride[]
}

export async function createProductWithPricing(options: CreateProductWithPricingOptions = {}) {
  const product = await createProduct({ status: 'published', ...options.product })
  const variant = await createProductVariant({ productId: product.id, ...options.variant })
  const priceSet = await createPriceSet()

  // Partial rather than `PriceOverride`: a caller that names neither still gets one random price,
  // which is what every spec that only needs a product to exist relies on.
  const requested: Array<Partial<PriceOverride>> = options.prices ?? [options.price ?? {}]
  const prices = requested.map((price) => ({
    amount: price.amount ?? faker.commerce.price({ min: 5, max: 200 }),
    currencyCode: price.currencyCode ?? 'usd',
  }))

  await Promise.all(
    prices.map((price) =>
      createPrice({
        priceSetId: priceSet.id,
        amount: new BigNumber(price.amount),
        currencyCode: price.currencyCode,
      }),
    ),
  )

  const [first] = prices
  if (!first) throw new Error('A product with pricing needs at least one price')

  const link = await createProductVariantPriceSet({
    variantId: variant.id,
    priceSetId: priceSet.id,
  })

  return {
    ...product,
    variant,
    priceSet,
    prices,
    // The first price stays the one `amount` and `currencyCode` name, so a single-currency caller
    // reads the same two fields it always did.
    amount: first.amount,
    currencyCode: first.currencyCode,
    [Symbol.asyncDispose]: async () => {
      await deleteProductVariantPriceSetById(link.id)
      // price cascades from price_set deletion
      await deletePriceSetById(priceSet.id)
      // variant cascades from product deletion
      await deleteProductById(product.id)
    },
  }
}
