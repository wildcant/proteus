import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { CreateProductDTO } from '@core/types/index.js'
import { test } from '@tests/setup/test-extend.js'
import { buildSearchFilter } from '../../../core/utils/build-search-filter.js'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import { ProductRepository } from '../repositories/product.js'
import { ProductImageRepository } from '../repositories/product-image.js'
import { ProductOptionRepository } from '../repositories/product-option.js'
import { ProductOptionValueRepository } from '../repositories/product-option-value.js'
import { ProductProductOptionRepository } from '../repositories/product-product-option.js'
import { ProductProductOptionValueRepository } from '../repositories/product-product-option-value.js'
import { ProductVariantRepository } from '../repositories/product-variant.js'
import { ProductVariantImageRepository } from '../repositories/product-variant-image.js'
import { ProductVariantOptionRepository } from '../repositories/product-variant-option.js'
import { ProductModuleService } from '../services/product-module-service.js'

let service: ProductModuleService

test.beforeEach(({ getDb, logger }) => {
  const productRepository = new ProductRepository({ getDb })
  const productVariantRepository = new ProductVariantRepository({ getDb })
  const productOptionRepository = new ProductOptionRepository({ getDb })
  const productOptionValueRepository = new ProductOptionValueRepository({ getDb })
  const productProductOptionRepository = new ProductProductOptionRepository({ getDb })
  const productProductOptionValueRepository = new ProductProductOptionValueRepository({ getDb })
  const productImageRepository = new ProductImageRepository({ getDb })
  const productVariantImageRepository = new ProductVariantImageRepository({ getDb })
  const productVariantOptionRepository = new ProductVariantOptionRepository({ getDb })
  const withTransaction = createWithTransaction(getDb)
  service = new ProductModuleService({
    productRepository,
    productVariantRepository,
    productOptionRepository,
    productOptionValueRepository,
    productProductOptionRepository,
    productProductOptionValueRepository,
    productImageRepository,
    productVariantImageRepository,
    productVariantOptionRepository,
    withTransaction,
    logger,
  })
})

test.describe('ProductModuleService', () => {
  test('listAndCountProducts with pagination', async ({ expect, dto }) => {
    await service.createProducts([
      dto.generate.createProduct(),
      dto.generate.createProduct(),
      dto.generate.createProduct(),
    ])

    const [rows, count] = await service.listAndCountProducts(undefined, { offset: 0, limit: 2 })

    expect(rows).toHaveLength(2)
    expect(count).toBe(3)
  })

  test('listAndCountProducts with single-word q search', async ({ expect }) => {
    await service.createProducts([{ title: 'Blue Widget' }, { title: 'Red Gadget' }, { title: 'Blue Gadget' }])

    const searchFilter = buildSearchFilter('blue', ['title', 'handle'])
    const [rows, count] = await service.listAndCountProducts(searchFilter)

    expect(count).toBe(2)
    expect(rows.map((r) => r.title).sort()).toEqual(['Blue Gadget', 'Blue Widget'])
  })

  test('listAndCountProducts with multi-word q search', async ({ expect }) => {
    await service.createProducts([{ title: 'Blue Widget' }, { title: 'Red Widget' }, { title: 'Blue Gadget' }])

    // "blue widget" should match only items where both "blue" AND "widget" match
    const searchFilter = buildSearchFilter('blue widget', ['title', 'handle'])
    const [rows, count] = await service.listAndCountProducts(searchFilter)

    expect(count).toBe(1)
    expect(rows[0]?.title).toBe('Blue Widget')
  })

  test('listAndCountProducts with status filter', async ({ expect, dto }) => {
    await service.createProducts([
      dto.generate.createProduct({ status: 'published' }),
      dto.generate.createProduct({ status: 'draft' }),
      dto.generate.createProduct({ status: 'published' }),
    ])

    const [rows, count] = await service.listAndCountProducts({ status: 'published' })

    expect(count).toBe(2)
    expect(rows.every((r) => r.status === 'published')).toBe(true)
  })

  test('listAndCountProducts with created_at range filter', async ({ expect, dto }) => {
    const oneMinuteAgo = new Date(Date.now() - 60_000)
    await service.createProducts([dto.generate.createProduct(), dto.generate.createProduct()])

    const [rows, count] = await service.listAndCountProducts({
      createdAt: { $gte: oneMinuteAgo },
    })

    expect(count).toBe(2)
    expect(rows).toHaveLength(2)
  })

  test('createProduct auto-generates handle from title', async ({ expect }) => {
    const product = await service.createProduct({ title: 'My Cool Product' })

    expect(product.title).toBe('My Cool Product')
    expect(product.handle).toBe('my-cool-product')
    expect(product.id).toBeDefined()
    expect(product.status).toBe('draft')
    expect(product.createdAt).toBeInstanceOf(Date)
  })

  test('updateProduct', async ({ expect, dto }) => {
    const created = await service.createProduct(dto.generate.createProduct())

    const updated = await service.updateProduct(created.id, { title: 'Updated Title' })

    expect(updated.title).toBe('Updated Title')
    expect(updated.id).toBe(created.id)
  })

  test('deleteProducts soft-deletes and excludes from list', async ({ expect, dto }) => {
    const created = await service.createProduct(dto.generate.createProduct())

    await service.deleteProducts([created.id])

    const products = await service.listProducts()
    expect(products).toHaveLength(0)
  })

  test('retrieveProduct by ID', async ({ expect, dto }) => {
    const created = await service.createProduct(dto.generate.createProduct())

    const product = await service.retrieveProduct(created.id)

    expect(product.id).toBe(created.id)
    expect(product.title).toBe(created.title)
  })

  test('retrieveProduct throws NOT_FOUND for soft-deleted product', async ({ expect, dto }) => {
    const created = await service.createProduct(dto.generate.createProduct())
    await service.deleteProducts([created.id])

    const error = await service.retrieveProduct(created.id).catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.NOT_FOUND)
  })

  test('upsertProductVariants creates variants without id', async ({ expect, dto }) => {
    const product = await service.createProduct(dto.generate.createProduct())

    const result = await service.upsertProductVariants([
      { productId: product.id, title: 'Small' },
      { productId: product.id, title: 'Large' },
    ])

    expect(result).toHaveLength(2)
    expect(result.map((v) => v.title).sort()).toEqual(['Large', 'Small'])
    expect(result.every((v) => v.productId === product.id)).toBe(true)
  })

  test('upsertProductVariants updates variants with id', async ({ expect, dto }) => {
    const product = await service.createProduct(dto.generate.createProduct())
    const variant = await service.createProductVariant({ productId: product.id, title: 'Original' })

    const result = await service.upsertProductVariants([{ id: variant.id, title: 'Updated' }])

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(variant.id)
    expect(result[0]?.title).toBe('Updated')
  })

  test('upsertProductVariants handles mixed creates and updates', async ({ expect, dto }) => {
    const product = await service.createProduct(dto.generate.createProduct())
    const existing = await service.createProductVariant({ productId: product.id, title: 'Existing' })

    const result = await service.upsertProductVariants([
      { id: existing.id, title: 'Renamed' },
      { productId: product.id, title: 'New Variant' },
    ])

    expect(result).toHaveLength(2)
    const renamed = result.find((v) => v.id === existing.id)
    const created = result.find((v) => v.id !== existing.id)
    expect(renamed?.title).toBe('Renamed')
    expect(created?.title).toBe('New Variant')
  })

  test('updateProductOption allows removing values not used by any product', async ({ expect }) => {
    const option = await service.createProductOption({
      title: 'Color',
      values: [{ value: 'Red' }, { value: 'Blue' }, { value: 'Green' }],
    })

    const updated = await service.updateProductOption(option.id, {
      values: [{ value: 'Red' }, { value: 'Blue' }],
    })

    expect(updated.values).toHaveLength(2)
    expect(updated.values.map((v) => v.value).sort()).toEqual(['Blue', 'Red'])
  })

  test('listAndCountProductsForOption returns linked products', async ({ expect, dto }) => {
    const option = await service.createProductOption({ title: 'Color', values: [{ value: 'Red' }] })
    const product1 = await service.createProduct(dto.generate.createProduct())
    const product2 = await service.createProduct(dto.generate.createProduct())
    await service.setProductOptions(product1.id, { options: [{ optionId: option.id, valueIds: [] }] })
    await service.setProductOptions(product2.id, { options: [{ optionId: option.id, valueIds: [] }] })

    const [products, count] = await service.listAndCountProductsForOption(option.id)

    expect(count).toBe(2)
    expect(products.map((p) => p.id).sort()).toEqual([product1.id, product2.id].sort())
  })

  test('listAndCountProductsForOption returns empty when no products linked', async ({ expect }) => {
    const option = await service.createProductOption({ title: 'Size', values: [{ value: 'S' }] })

    const [products, count] = await service.listAndCountProductsForOption(option.id)

    expect(count).toBe(0)
    expect(products).toHaveLength(0)
  })

  test('updateProductOption throws when removing a value used by a product', async ({ expect, dto }) => {
    const option = await service.createProductOption({
      title: 'Color',
      values: [{ value: 'Red' }, { value: 'Blue' }],
    })
    const product = await service.createProduct(dto.generate.createProduct())
    const blueValue = option.values.find((v) => v.value === 'Blue')
    if (!blueValue) throw new Error('Expected Blue value to exist')
    await service.setProductOptions(product.id, {
      options: [{ optionId: option.id, valueIds: [blueValue.id] }],
    })

    const error = await service.updateProductOption(option.id, { values: [{ value: 'Red' }] }).catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.NOT_ALLOWED)
    expect(error.message).toContain('Cannot remove option value(s)')
  })

  test('createProduct with images ranks them by array index and auto-sets the thumbnail', async ({ expect, dto }) => {
    const product = await service.createProduct(
      dto.generate.createProduct({
        images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
      }),
    )

    const images = await service.listProductImages({ productId: product.id }, { order: { rank: 'ASC' } })

    expect(images.map((i) => [i.url, i.rank])).toEqual([
      ['https://cdn.test/a.png', 0],
      ['https://cdn.test/b.png', 1],
    ])
    expect(product.thumbnail).toBe('https://cdn.test/a.png')
  })
  test('createProduct keeps an explicitly provided thumbnail', async ({ expect, dto }) => {
    const product = await service.createProduct(
      dto.generate.createProduct({
        thumbnail: 'https://cdn.test/hero.png',
        images: [{ url: 'https://cdn.test/a.png' }],
      }),
    )

    expect(product.thumbnail).toBe('https://cdn.test/hero.png')
  })
  test('updateProduct replaces the image collection: keeps by id, re-ranks, creates and soft-deletes', async ({
    expect,
    dto,
  }) => {
    const product = await service.createProduct(
      dto.generate.createProduct({
        images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
      }),
    )
    const [first, second] = await service.listProductImages({ productId: product.id }, { order: { rank: 'ASC' } })
    if (!first || !second) throw new Error('Expected two images to exist')

    await service.updateProduct(product.id, {
      images: [{ url: 'https://cdn.test/c.png' }, { id: second.id, url: second.url }],
    })

    const images = await service.listProductImages({ productId: product.id }, { order: { rank: 'ASC' } })
    expect(images.map((i) => [i.url, i.rank])).toEqual([
      ['https://cdn.test/c.png', 0],
      ['https://cdn.test/b.png', 1],
    ])
    expect(images.map((i) => i.id)).toContain(second.id)

    const withDeleted = await service.listProductImages({ productId: product.id }, { withDeleted: true })
    expect(withDeleted.find((i) => i.id === first.id)?.deletedAt).toBeInstanceOf(Date)
  })
  test('updateProduct auto-sets the thumbnail to the first image of the new collection', async ({ expect, dto }) => {
    const product = await service.createProduct(
      dto.generate.createProduct({ images: [{ url: 'https://cdn.test/a.png' }] }),
    )

    const updated = await service.updateProduct(product.id, {
      images: [{ url: 'https://cdn.test/b.png' }, { url: 'https://cdn.test/a.png' }],
    })

    expect(updated.thumbnail).toBe('https://cdn.test/b.png')
  })

  test('updateProduct with an empty image collection clears images and the thumbnail', async ({ expect, dto }) => {
    const product = await service.createProduct(
      dto.generate.createProduct({ images: [{ url: 'https://cdn.test/a.png' }] }),
    )

    const updated = await service.updateProduct(product.id, { images: [] })

    expect(updated.thumbnail).toBeNull()
    expect(await service.listProductImages({ productId: product.id })).toHaveLength(0)
  })

  test('updateProduct without an image collection leaves existing images untouched', async ({ expect, dto }) => {
    const product = await service.createProduct(
      dto.generate.createProduct({ images: [{ url: 'https://cdn.test/a.png' }] }),
    )

    const updated = await service.updateProduct(product.id, { title: 'Renamed' })

    expect(updated.title).toBe('Renamed')
    expect(updated.thumbnail).toBe('https://cdn.test/a.png')
    expect(await service.listProductImages({ productId: product.id })).toHaveLength(1)
  })

  test('updateProducts replaces the image collection of every product', async ({ expect, dto }) => {
    const [first, second] = await service.createProducts([
      dto.generate.createProduct({ images: [{ url: 'https://cdn.test/old.png' }] }),
      dto.generate.createProduct(),
    ])
    if (!first || !second) throw new Error('Expected two products to exist')

    const updated = await service.updateProducts([first.id, second.id], {
      images: [{ url: 'https://cdn.test/new.png' }],
    })

    expect(updated.every((p) => p.thumbnail === 'https://cdn.test/new.png')).toBe(true)
    for (const product of [first, second]) {
      const images = await service.listProductImages({ productId: product.id })
      expect(images.map((i) => i.url)).toEqual(['https://cdn.test/new.png'])
    }
  })
  test('createProducts attaches each image collection to its own product', async ({ expect, dto }) => {
    const [first, second] = await service.createProducts([
      dto.generate.createProduct({ images: [{ url: 'https://cdn.test/first.png' }] }),
      dto.generate.createProduct({ images: [{ url: 'https://cdn.test/second.png' }] }),
    ])
    if (!first || !second) throw new Error('Expected two products to exist')

    expect(await service.listProductImages({ productId: first.id })).toMatchObject([
      { url: 'https://cdn.test/first.png' },
    ])
    expect(await service.listProductImages({ productId: second.id })).toMatchObject([
      { url: 'https://cdn.test/second.png' },
    ])
  })
})

test.describe('ProductModuleService variant images', () => {
  const createProductWithVariantAndImage = async (draft: CreateProductDTO) => {
    const product = await service.createProduct({
      ...draft,
      images: [{ url: 'https://cdn.test/a.png' }, { url: 'https://cdn.test/b.png' }],
    })
    const [image, otherImage] = await service.listProductImages({ productId: product.id }, { order: { rank: 'ASC' } })
    const variant = await service.createProductVariant({ productId: product.id, title: 'Small' })
    if (!image || !otherImage) throw new Error('Expected two product images to exist')
    return { product, image, otherImage, variant }
  }

  test('addImageToVariant creates pivot records', async ({ expect, dto }) => {
    const { image, variant } = await createProductWithVariantAndImage(dto.generate.createProduct())

    const created = await service.addImageToVariant([{ imageId: image.id, variantId: variant.id }])

    expect(created).toEqual([{ id: expect.stringMatching(/^pvimg_/) }])
    expect(await service.listProductVariantImages({ variantId: variant.id })).toMatchObject([
      { imageId: image.id, variantId: variant.id },
    ])
  })

  test('addImageToVariant rejects a duplicate image/variant pair', async ({ expect, dto }) => {
    const { image, variant } = await createProductWithVariantAndImage(dto.generate.createProduct())
    await service.addImageToVariant([{ imageId: image.id, variantId: variant.id }])

    await expect(service.addImageToVariant([{ imageId: image.id, variantId: variant.id }])).rejects.toThrow()
  })

  test('removeImageFromVariant soft-deletes the matching pivot record', async ({ expect, dto }) => {
    const { image, otherImage, variant } = await createProductWithVariantAndImage(dto.generate.createProduct())
    await service.addImageToVariant([
      { imageId: image.id, variantId: variant.id },
      { imageId: otherImage.id, variantId: variant.id },
    ])

    await service.removeImageFromVariant([{ imageId: image.id, variantId: variant.id }])

    expect(await service.listProductVariantImages({ variantId: variant.id })).toMatchObject([
      { imageId: otherImage.id },
    ])
  })

  test('removeImageFromVariant skips a pair that was never linked without touching the others', async ({
    expect,
    dto,
  }) => {
    const { image, otherImage, variant } = await createProductWithVariantAndImage(dto.generate.createProduct())
    await service.addImageToVariant([{ imageId: image.id, variantId: variant.id }])

    await service.removeImageFromVariant([{ imageId: otherImage.id, variantId: variant.id }])

    expect(await service.listProductVariantImages({ variantId: variant.id })).toMatchObject([{ imageId: image.id }])
  })

  test('a removed pair can be linked again', async ({ expect, dto }) => {
    const { image, variant } = await createProductWithVariantAndImage(dto.generate.createProduct())
    await service.addImageToVariant([{ imageId: image.id, variantId: variant.id }])
    await service.removeImageFromVariant([{ imageId: image.id, variantId: variant.id }])

    await service.addImageToVariant([{ imageId: image.id, variantId: variant.id }])

    expect(await service.listProductVariantImages({ variantId: variant.id })).toHaveLength(1)
  })
})

test.describe('ProductModuleService variant options', () => {
  /** A product offering Size (S/M) and Colour (Red/Blue), in that rank order. */
  const createProductWithOptions = async (draft: CreateProductDTO) => {
    const product = await service.createProduct(draft)
    const size = await service.createProductOption({
      title: `Size-${product.id}`,
      values: [{ value: 'S' }, { value: 'M' }],
    })
    const colour = await service.createProductOption({
      title: `Colour-${product.id}`,
      renderAs: 'swatch',
      values: [{ value: 'Red' }, { value: 'Blue' }],
    })
    await service.setProductOptions(product.id, {
      options: [
        { optionId: size.id, valueIds: size.values.map((value) => value.id) },
        { optionId: colour.id, valueIds: colour.values.map((value) => value.id) },
      ],
    })

    const valueId = (option: typeof size, value: string) => {
      const match = option.values.find((candidate) => candidate.value === value)
      if (!match) throw new Error(`Expected option to carry the value "${value}"`)
      return match.id
    }

    return {
      product,
      size,
      colour,
      /** e.g. tuple('S', 'Red') */
      tuple: (sizeValue: string, colourValue: string) => ({
        [size.id]: valueId(size, sizeValue),
        [colour.id]: valueId(colour, colourValue),
      }),
    }
  }

  test('createProductVariant persists the option tuple', async ({ expect, dto }) => {
    const { product, size, colour, tuple } = await createProductWithOptions(dto.generate.createProduct())

    const variant = await service.createProductVariant({
      productId: product.id,
      title: 'S / Red',
      optionValues: tuple('S', 'Red'),
    })

    const links = await service.listProductVariantOptions({ variantId: variant.id })
    expect(links).toHaveLength(2)
    expect(links.map((link) => link.optionId).sort()).toEqual([size.id, colour.id].sort())
    expect(links.every((link) => link.id.startsWith('pvopt_'))).toBe(true)
  })

  test("enrichVariants attaches each variant's option tuple", async ({ expect, dto }) => {
    const { product, size, colour, tuple } = await createProductWithOptions(dto.generate.createProduct())
    const withOptions = await service.createProductVariant({
      productId: product.id,
      title: 'S / Red',
      optionValues: tuple('S', 'Red'),
    })
    const withoutOptions = await service.createProductVariant({ productId: product.id, title: 'bare' })

    const enriched = await service.enrichVariants([withOptions, withoutOptions])

    expect(enriched[0]?.optionValues).toEqual({
      [size.id]: tuple('S', 'Red')[size.id],
      [colour.id]: tuple('S', 'Red')[colour.id],
    })
    // A variant carrying nothing gets an empty tuple rather than a missing key.
    expect(enriched[1]?.optionValues).toEqual({})
    // The scalar fields survive the spread.
    expect(enriched[0]?.title).toBe('S / Red')
  })

  test('enrichVariants on an empty list makes no query', async ({ expect }) => {
    expect(await service.enrichVariants([])).toEqual([])
  })

  test('listOptionValuesForVariant resolves the values a variant carries', async ({ expect, dto }) => {
    const { product, tuple } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      title: 'M / Blue',
      optionValues: tuple('M', 'Blue'),
    })

    const values = await service.listOptionValuesForVariant(variant.id)

    expect(values.map((value) => value.value).sort()).toEqual(['Blue', 'M'])
  })

  test('updating with optionValues replaces the tuple', async ({ expect, dto }) => {
    const { product, colour, tuple } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      title: 'S / Red',
      optionValues: tuple('S', 'Red'),
    })

    await service.updateProductVariant(variant.id, { optionValues: tuple('S', 'Blue') })

    const values = await service.listOptionValuesForVariant(variant.id)
    expect(values.map((value) => value.value).sort()).toEqual(['Blue', 'S'])
    const links = await service.listProductVariantOptions({ variantId: variant.id })
    expect(links.filter((link) => link.optionId === colour.id)).toHaveLength(1)
  })

  test('updating without optionValues leaves the tuple untouched', async ({ expect, dto }) => {
    const { product, tuple } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      title: 'S / Red',
      optionValues: tuple('S', 'Red'),
    })

    await service.updateProductVariant(variant.id, { title: 'Renamed' })

    const values = await service.listOptionValuesForVariant(variant.id)
    expect(values.map((value) => value.value).sort()).toEqual(['Red', 'S'])
  })

  test('an empty optionValues map clears the tuple', async ({ expect, dto }) => {
    const { product, tuple } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      title: 'S / Red',
      optionValues: tuple('S', 'Red'),
    })

    await service.updateProductVariant(variant.id, { optionValues: {} })

    expect(await service.listProductVariantOptions({ variantId: variant.id })).toEqual([])
  })

  test('a mixed batch only touches the variants that carry a tuple', async ({ expect, dto }) => {
    const { product, tuple } = await createProductWithOptions(dto.generate.createProduct())
    const untouched = await service.createProductVariant({
      productId: product.id,
      title: 'keeps its tuple',
      optionValues: tuple('M', 'Blue'),
    })

    await service.upsertProductVariants([
      { productId: product.id, title: 'new one', optionValues: tuple('S', 'Red') },
      { id: untouched.id, title: 'renamed only' },
    ])

    const values = await service.listOptionValuesForVariant(untouched.id)
    expect(values.map((value) => value.value).sort()).toEqual(['Blue', 'M'])
  })

  test('a partial tuple is rejected', async ({ expect, dto }) => {
    const { product, size } = await createProductWithOptions(dto.generate.createProduct())
    const smallId = size.values.find((value) => value.value === 'S')?.id
    if (!smallId) throw new Error('Expected the Size option to carry an S value')

    const error = await service
      .createProductVariant({ productId: product.id, title: 'S', optionValues: { [size.id]: smallId } })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.INVALID_DATA)
    expect(error.message).toContain('Product has 2 option(s) but 1 option value(s) were provided')
  })

  test('a value the product does not offer is rejected', async ({ expect, dto }) => {
    const { product, size, colour, tuple } = await createProductWithOptions(dto.generate.createProduct())
    // Narrow the product to Red only, so Blue exists on the option but not on this product.
    await service.setProductOptions(product.id, {
      options: [
        { optionId: size.id, valueIds: size.values.map((value) => value.id) },
        { optionId: colour.id, valueIds: [colour.values.filter((value) => value.value === 'Red')[0]?.id ?? ''] },
      ],
    })

    const error = await service
      .createProductVariant({ productId: product.id, title: 'S / Blue', optionValues: tuple('S', 'Blue') })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.INVALID_DATA)
    expect(error.message).toContain('does not exist for option')
  })

  test('two variants in one batch cannot claim the same combination', async ({ expect, dto }) => {
    const { product, tuple } = await createProductWithOptions(dto.generate.createProduct())

    const error = await service
      .createProductVariants([
        { productId: product.id, title: 'first', optionValues: tuple('S', 'Red') },
        { productId: product.id, title: 'second', optionValues: tuple('S', 'Red') },
      ])
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.INVALID_DATA)
    expect(error.message).toContain('has the same combination of option values as')
  })

  test('a combination already on the product is rejected', async ({ expect, dto }) => {
    const { product, tuple } = await createProductWithOptions(dto.generate.createProduct())
    await service.createProductVariant({ productId: product.id, title: 'S / Red', optionValues: tuple('S', 'Red') })

    const error = await service
      .createProductVariant({ productId: product.id, title: 'duplicate', optionValues: tuple('S', 'Red') })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.INVALID_DATA)
    expect(error.message).toContain('with the provided options already exists')
  })

  test('re-sending a variant its own tuple is not a collision', async ({ expect, dto }) => {
    const { product, tuple } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      title: 'S / Red',
      optionValues: tuple('S', 'Red'),
    })

    await service.updateProductVariant(variant.id, { optionValues: tuple('S', 'Red') })

    const values = await service.listOptionValuesForVariant(variant.id)
    expect(values.map((value) => value.value).sort()).toEqual(['Red', 'S'])
  })

  test('two values of the same option cannot both be assigned', async ({ expect, dto, getDb }) => {
    const { product, size } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({ productId: product.id, title: 'bare' })
    const [small, medium] = size.values
    if (!small || !medium) throw new Error('Expected the Size option to carry two values')

    // Straight at the repository, since the DTO's map shape makes this unrepresentable.
    const productVariantOptionRepository = new ProductVariantOptionRepository({ getDb })
    await productVariantOptionRepository.create({
      variantId: variant.id,
      optionId: size.id,
      optionValueId: small.id,
    })

    await expect(
      productVariantOptionRepository.create({ variantId: variant.id, optionId: size.id, optionValueId: medium.id }),
    ).rejects.toThrow()
  })

  test('deleteProductVariants releases the option links', async ({ expect, dto }) => {
    const { product, tuple } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      title: 'S / Red',
      optionValues: tuple('S', 'Red'),
    })

    await service.deleteProductVariants([variant.id])

    expect(await service.listProductVariantOptions({ variantId: variant.id })).toEqual([])
  })

  test('setProductOptions refuses to drop a value a variant still carries', async ({ expect, dto }) => {
    const { product, size, colour, tuple } = await createProductWithOptions(dto.generate.createProduct())
    await service.createProductVariant({ productId: product.id, title: 'S / Red', optionValues: tuple('S', 'Red') })
    const blue = colour.values.find((value) => value.value === 'Blue')
    if (!blue) throw new Error('Expected the Colour option to carry a Blue value')

    const error = await service
      .setProductOptions(product.id, {
        options: [
          { optionId: size.id, valueIds: size.values.map((value) => value.id) },
          { optionId: colour.id, valueIds: [blue.id] },
        ],
      })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.NOT_ALLOWED)
    expect(error.message).toContain('Cannot remove option value(s) that are currently used by variants: Red')
  })

  test('setProductOptions refuses to drop an option a variant still carries', async ({ expect, dto }) => {
    const { product, size, colour, tuple } = await createProductWithOptions(dto.generate.createProduct())
    await service.createProductVariant({ productId: product.id, title: 'S / Red', optionValues: tuple('S', 'Red') })

    const error = await service
      .setProductOptions(product.id, {
        options: [{ optionId: size.id, valueIds: size.values.map((value) => value.id) }],
      })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.NOT_ALLOWED)
    expect(error.message).toContain(`Cannot remove option(s) that are currently used by variants: ${colour.title}`)
  })

  test('listProductOptionsForProduct returns options in the order they were set', async ({ expect, dto }) => {
    const { product, size, colour } = await createProductWithOptions(dto.generate.createProduct())

    const inOrder = await service.listProductOptionsForProduct(product.id)
    expect(inOrder.map((option) => option.id)).toEqual([size.id, colour.id])

    await service.setProductOptions(product.id, {
      options: [
        { optionId: colour.id, valueIds: colour.values.map((value) => value.id) },
        { optionId: size.id, valueIds: size.values.map((value) => value.id) },
      ],
    })

    const reordered = await service.listProductOptionsForProduct(product.id)
    expect(reordered.map((option) => option.id)).toEqual([colour.id, size.id])
    expect(reordered[0]?.renderAs).toBe('swatch')
  })
})
