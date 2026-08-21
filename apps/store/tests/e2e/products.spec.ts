import { faker } from '@faker-js/faker'
import type { Factories } from '@proteus/testing'
import { expect, test } from '../setup/test-extend.js'

/**
 * Two colourways of the same product, one image each, so the gallery has an unambiguous image to
 * show per variant. Every variant needs a price or the store route drops it from the response.
 */
async function createProductWithColourways(factories: Factories) {
  const product = await factories.create.product({ status: 'published' })
  const black = await factories.create.productImage({
    productId: product.id,
    url: 'https://cdn.test/black.png',
    rank: 0,
  })
  const white = await factories.create.productImage({
    productId: product.id,
    url: 'https://cdn.test/white.png',
    rank: 1,
  })
  const blackVariant = await factories.create.productVariant({ productId: product.id, title: 'Black' })
  const whiteVariant = await factories.create.productVariant({ productId: product.id, title: 'White' })
  const links = [
    await factories.create.productVariantImage({ variantId: blackVariant.id, imageId: black.id }),
    await factories.create.productVariantImage({ variantId: whiteVariant.id, imageId: white.id }),
  ]

  const prices = await Promise.all(
    [blackVariant, whiteVariant].map(async (variant) => {
      const priceSet = await factories.create.priceSet()
      const price = await factories.create.price({ priceSetId: priceSet.id, currencyCode: 'usd' })
      const link = await factories.create.productVariantPriceSet({ variantId: variant.id, priceSetId: priceSet.id })
      return { priceSet, price, link }
    }),
  )

  return {
    product,
    black,
    white,
    blackVariant,
    whiteVariant,
    [Symbol.asyncDispose]: async () => {
      for (const { link, price, priceSet } of prices) {
        await factories.destroy.productVariantPriceSet(link.id)
        await factories.destroy.price(price.id)
        await factories.destroy.priceSet(priceSet.id)
      }
      for (const link of links) await factories.destroy.productVariantImage(link.id)
      // Variants and images cascade from the product.
      await factories.destroy.product(product.id)
    },
  }
}

test.describe('Products', () => {
  test('product list page shows seeded products', async ({ page, authenticate, navigate, factories }) => {
    await using product = await factories.create.product({ status: 'published' })
    await authenticate({ as: 'customer' })

    await navigate({ to: '/products' })

    await expect(page.getByText(product.title)).toBeVisible()
  })

  test('product detail page shows product info', async ({ page, authenticate, navigate, factories }) => {
    const description = faker.commerce.productDescription()
    await using product = await factories.create.product({ status: 'published', description })
    await authenticate({ as: 'customer' })

    await navigate({ to: '/products/$productId', params: { productId: product.id } })

    await expect(page.getByRole('heading', { name: product.title })).toBeVisible()
    if (!product.description) throw new Error('Seeded product is missing a description')
    await expect(page.getByText(product.description)).toBeVisible()
  })

  test('gallery follows the selected variant', async ({ page, authenticate, navigate, factories }) => {
    await using catalog = await createProductWithColourways(factories)
    await authenticate({ as: 'customer' })

    // Pin the starting variant so the assertion does not depend on how variants come back ordered.
    await navigate({
      to: '/products/$productId',
      params: { productId: catalog.product.id },
      search: { variant: catalog.blackVariant.id },
    })

    const mainImage = page.getByRole('img', { name: catalog.product.title })
    await expect(mainImage).toHaveAttribute('src', catalog.black.url)

    await page.getByLabel('Variant').selectOption(catalog.whiteVariant.id)

    await expect(mainImage).toHaveAttribute('src', catalog.white.url)
    await expect(page).toHaveURL(new RegExp(`variant=${catalog.whiteVariant.id}`))
  })
})
