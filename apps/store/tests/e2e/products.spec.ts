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

/**
 * One variant, two images, and no variant/image links — which is what makes the page fall back to
 * the whole product gallery and gives the carousel more than one slide to move between.
 */
async function createProductWithTwoImages(factories: Factories) {
  const product = await factories.create.product({ status: 'published' })
  const images = [
    await factories.create.productImage({ productId: product.id, url: 'https://cdn.test/first.png', rank: 0 }),
    await factories.create.productImage({ productId: product.id, url: 'https://cdn.test/second.png', rank: 1 }),
  ]
  const variant = await factories.create.productVariant({ productId: product.id, title: 'Only' })
  const priceSet = await factories.create.priceSet()
  const price = await factories.create.price({ priceSetId: priceSet.id, currencyCode: 'usd' })
  const priceLink = await factories.create.productVariantPriceSet({ variantId: variant.id, priceSetId: priceSet.id })

  return {
    product,
    images,
    variant,
    [Symbol.asyncDispose]: async () => {
      await factories.destroy.productVariantPriceSet(priceLink.id)
      await factories.destroy.price(price.id)
      await factories.destroy.priceSet(priceSet.id)
      // Variants and images cascade from the product.
      await factories.destroy.product(product.id)
    },
  }
}

/**
 * One product offering Size (S/M) then Colour (Black/White), with three variants: S/Black, S/White
 * and M/Black. M/White is deliberately absent so the picker has an unavailable combination to show.
 */
async function createProductWithOptions(factories: Factories) {
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

  const size = await factories.create.productOption({ title: `Size-${product.id}`, renderAs: 'text' })
  const colour = await factories.create.productOption({ title: `Colour-${product.id}`, renderAs: 'swatch' })
  const sizeValues = {
    S: await factories.create.productOptionValue({ optionId: size.id, value: 'S', rank: 0 }),
    M: await factories.create.productOptionValue({ optionId: size.id, value: 'M', rank: 1 }),
  }
  const colourValues = {
    Black: await factories.create.productOptionValue({ optionId: colour.id, value: 'Black', rank: 0 }),
    White: await factories.create.productOptionValue({ optionId: colour.id, value: 'White', rank: 1 }),
  }

  // Offer both options on the product, Size first so the picker resolves Size then Colour.
  const productOptions = [
    await factories.create.productProductOption({ productId: product.id, optionId: size.id, rank: 0 }),
    await factories.create.productProductOption({ productId: product.id, optionId: colour.id, rank: 1 }),
  ]
  const offered = await Promise.all(
    [
      ...Object.values(sizeValues).map((value) => ({ link: productOptions[0], value })),
      ...Object.values(colourValues).map((value) => ({ link: productOptions[1], value })),
    ].map(({ link, value }) => {
      if (!link) throw new Error('Expected the product-option link to exist')
      return factories.create.productProductOptionValue({ productProductOptionId: link.id, optionValueId: value.id })
    }),
  )

  const offeredByValueId = new Map(offered.map((offeredValue) => [offeredValue.optionValueId, offeredValue]))

  const combinations = [
    { title: 'S / Black', size: sizeValues.S, colour: colourValues.Black, image: black },
    { title: 'S / White', size: sizeValues.S, colour: colourValues.White, image: white },
    { title: 'M / Black', size: sizeValues.M, colour: colourValues.Black, image: black },
  ]

  const built = await Promise.all(
    combinations.map(async (combination) => {
      const variant = await factories.create.productVariant({ productId: product.id, title: combination.title })
      // A variant carries the product's value, not the global one.
      const links = await Promise.all(
        [combination.size, combination.colour].map((value) => {
          const offeredValue = offeredByValueId.get(value.id)
          if (!offeredValue) throw new Error(`Expected the product to offer option value "${value.id}"`)
          return factories.create.productVariantOption({
            variantId: variant.id,
            productProductOptionValueId: offeredValue.id,
          })
        }),
      )
      const image = await factories.create.productVariantImage({
        variantId: variant.id,
        imageId: combination.image.id,
      })
      const priceSet = await factories.create.priceSet()
      const price = await factories.create.price({ priceSetId: priceSet.id, currencyCode: 'usd' })
      const priceLink = await factories.create.productVariantPriceSet({
        variantId: variant.id,
        priceSetId: priceSet.id,
      })
      return { variant, links, image, priceSet, price, priceLink }
    }),
  )

  const [sBlack, sWhite, mBlack] = built
  if (!sBlack || !sWhite || !mBlack) throw new Error('Expected three variants to be built')

  return {
    product,
    black,
    white,
    sBlack: sBlack.variant,
    sWhite: sWhite.variant,
    mBlack: mBlack.variant,
    [Symbol.asyncDispose]: async () => {
      for (const entry of built) {
        await factories.destroy.productVariantPriceSet(entry.priceLink.id)
        await factories.destroy.price(entry.price.id)
        await factories.destroy.priceSet(entry.priceSet.id)
        await factories.destroy.productVariantImage(entry.image.id)
        for (const link of entry.links) await factories.destroy.productVariantOption(link.id)
      }
      for (const link of offered) await factories.destroy.productProductOptionValue(link.id)
      for (const link of productOptions) {
        if (link) await factories.destroy.productProductOption(link.id)
      }
      // Variants and images cascade from the product; option values cascade from their option.
      await factories.destroy.product(product.id)
      await factories.destroy.productOption(size.id)
      await factories.destroy.productOption(colour.id)
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

    // Every slide is a titled image now, so the claim is about the whole strip rather than about
    // a hero that no longer exists: the count proves the other colourway's photo is gone.
    const gallery = page.getByRole('list', { name: `${catalog.product.title} images` })
    await expect(gallery.getByRole('img')).toHaveCount(1)
    await expect(gallery.getByRole('img')).toHaveAttribute('src', catalog.black.url)

    await page.getByLabel('Variant').selectOption(catalog.whiteVariant.id)

    await expect(gallery.getByRole('img')).toHaveCount(1)
    await expect(gallery.getByRole('img')).toHaveAttribute('src', catalog.white.url)
    await expect(page).toHaveURL(new RegExp(`variant=${catalog.whiteVariant.id}`))
  })
  test('renders a picker per option and follows the selection', async ({ page, authenticate, navigate, factories }) => {
    await using catalog = await createProductWithOptions(factories)
    await authenticate({ as: 'customer' })

    await navigate({
      to: '/products/$productId',
      params: { productId: catalog.product.id },
      search: { variant: catalog.sBlack.id },
    })

    // Size renders as a text grid, Colour as image swatches. Both are native radio groups.
    await expect(page.getByRole('radio', { name: 'S', exact: true })).toBeChecked()
    const white = page.getByRole('radio', { name: 'White' })
    await expect(white).not.toBeChecked()

    // The radio is `sr-only`, so it paints nothing and cannot be the hit target. The swatch label
    // is what a shopper clicks, and `htmlFor` forwards it to the radio behind.
    await page.locator(`label[for="${await white.getAttribute('id')}"]`).click()

    await expect(white).toBeChecked()
    await expect(page).toHaveURL(new RegExp(`variant=${catalog.sWhite.id}`))

    const gallery = page.getByRole('list', { name: `${catalog.product.title} images` })
    await expect(gallery.getByRole('img')).toHaveCount(1)
    await expect(gallery.getByRole('img')).toHaveAttribute('src', catalog.white.url)
  })

  test('a combination no variant covers is disabled', async ({ page, authenticate, navigate, factories }) => {
    await using catalog = await createProductWithOptions(factories)
    await authenticate({ as: 'customer' })

    // M only exists in Black, so from M the White swatch has no variant to land on.
    await navigate({
      to: '/products/$productId',
      params: { productId: catalog.product.id },
      search: { variant: catalog.mBlack.id },
    })

    await expect(page.getByRole('radio', { name: 'White' })).toBeDisabled()
    // Size stays open, so the shopper is never stranded.
    await expect(page.getByRole('radio', { name: 'S', exact: true })).toBeEnabled()
  })

  test('the gallery dots move the carousel', async ({ page, authenticate, navigate, factories }) => {
    await using catalog = await createProductWithTwoImages(factories)
    await authenticate({ as: 'customer' })

    // The dots are `lg:hidden` and playwright.config.ts declares one project at 1280, so this test
    // has to set its own viewport — the carousel only exists below `lg`.
    await page.setViewportSize({ width: 390, height: 844 })
    await navigate({ to: '/products/$productId', params: { productId: catalog.product.id } })

    const scroller = page.getByRole('list', { name: `${catalog.product.title} images` })
    await expect(scroller.getByRole('img')).toHaveCount(2)

    await page.getByRole('button', { name: 'Show image 2' }).click()

    // A slide per viewport width, so "slide 2 is in view" is scrollLeft === one clientWidth.
    await expect
      .poll(() => scroller.evaluate((element) => Math.round(element.scrollLeft / element.clientWidth)))
      .toBe(1)
    await expect(page.getByRole('button', { name: 'Show image 2' })).toHaveAttribute('aria-current', 'true')
  })

  test('a product whose variants carry no options keeps the variant select', async ({
    page,
    authenticate,
    navigate,
    factories,
  }) => {
    await using catalog = await createProductWithColourways(factories)
    await authenticate({ as: 'customer' })

    await navigate({ to: '/products/$productId', params: { productId: catalog.product.id } })

    await expect(page.getByLabel('Variant')).toBeVisible()
  })
})
