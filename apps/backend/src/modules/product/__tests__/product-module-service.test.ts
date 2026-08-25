import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { CreateProductDTO, VariantImageInput } from '@core/types/index.js'
import { test } from '@tests/setup/test-extend.js'
import { buildCascadeGraph } from '../../../core/db/cascade-graph.js'
import { buildSearchFilter } from '../../../core/utils/build-search-filter.js'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import * as models from '../models/index.js'
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

const cascadeGraph = buildCascadeGraph(models)

let service: ProductModuleService
/** Two rules have no service verb to reach them: the product module has no restore, and the
 *  walker's restrict backstop only fires where the service's own pre-check has not already. */
let productRepository: ProductRepository
let productOptionRepository: ProductOptionRepository
let productOptionValueRepository: ProductOptionValueRepository
/** I1 and I5 are database constraints, so proving them means writing a row no service verb emits. */
let productProductOptionRepository: ProductProductOptionRepository
let productProductOptionValueRepository: ProductProductOptionValueRepository
let productVariantOptionRepository: ProductVariantOptionRepository

test.beforeEach(({ getDb, logger }) => {
  productRepository = new ProductRepository({ getDb, cascadeGraph })
  const productVariantRepository = new ProductVariantRepository({ getDb, cascadeGraph })
  productOptionRepository = new ProductOptionRepository({ getDb, cascadeGraph })
  productOptionValueRepository = new ProductOptionValueRepository({ getDb, cascadeGraph })
  productProductOptionRepository = new ProductProductOptionRepository({ getDb, cascadeGraph })
  productProductOptionValueRepository = new ProductProductOptionValueRepository({ getDb, cascadeGraph })
  const productImageRepository = new ProductImageRepository({ getDb, cascadeGraph })
  const productVariantImageRepository = new ProductVariantImageRepository({ getDb, cascadeGraph })
  productVariantOptionRepository = new ProductVariantOptionRepository({ getDb, cascadeGraph })
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

  test('softDeleteProducts soft-deletes and excludes from list', async ({ expect, dto }) => {
    const created = await service.createProduct(dto.generate.createProduct())

    await service.softDeleteProducts([created.id])

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
    await service.softDeleteProducts([created.id])

    const error = await service.retrieveProduct(created.id).catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.NOT_FOUND)
  })

  test('upsertProductVariants creates variants without id', async ({ expect, dto }) => {
    const product = await service.createProduct({ ...dto.generate.createProduct(), title: 'Enamel Mug' })

    const result = await service.upsertProductVariants([
      { productId: product.id, sku: 'MUG-S', optionValues: {} },
      { productId: product.id, sku: 'MUG-L', optionValues: {} },
    ])

    expect(result).toHaveLength(2)
    expect(result.map((v) => v.sku).sort()).toEqual(['MUG-L', 'MUG-S'])
    // Both take the product's name: an option-less product has no combination to name them by.
    expect(result.map((v) => v.title)).toEqual(['Enamel Mug', 'Enamel Mug'])
    expect(result.every((v) => v.productId === product.id)).toBe(true)
  })

  test('upsertProductVariants updates variants with id', async ({ expect, dto }) => {
    const product = await service.createProduct(dto.generate.createProduct())
    const variant = await service.createProductVariant({ productId: product.id, optionValues: {} })

    const result = await service.upsertProductVariants([{ id: variant.id, sku: 'UPDATED' }])

    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(variant.id)
    expect(result[0]?.sku).toBe('UPDATED')
  })

  test('upsertProductVariants handles mixed creates and updates', async ({ expect, dto }) => {
    const product = await service.createProduct(dto.generate.createProduct())
    const existing = await service.createProductVariant({ productId: product.id, optionValues: {} })

    const result = await service.upsertProductVariants([
      { id: existing.id, sku: 'RENAMED' },
      { productId: product.id, sku: 'CREATED', optionValues: {} },
    ])

    expect(result).toHaveLength(2)
    const updated = result.find((v) => v.id === existing.id)
    const created = result.find((v) => v.id !== existing.id)
    expect(updated?.sku).toBe('RENAMED')
    expect(created?.sku).toBe('CREATED')
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
    const valueIds = option.values.map((value) => value.id)
    const product1 = await service.createProduct(dto.generate.createProduct())
    const product2 = await service.createProduct(dto.generate.createProduct())
    await service.setProductOptions(product1.id, { options: [{ optionId: option.id, valueIds }] })
    await service.setProductOptions(product2.id, { options: [{ optionId: option.id, valueIds }] })

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
    const variant = await service.createProductVariant({ productId: product.id, optionValues: {} })
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
      /** e.g. combination('S', 'Red') */
      combination: (sizeValue: string, colourValue: string) => ({
        [size.id]: valueId(size, sizeValue),
        [colour.id]: valueId(colour, colourValue),
      }),
    }
  }

  /** The product's own row for a global option, and the value rows hanging off it. */
  const productOptionRowsFor = async (productId: string, optionId: string) => {
    const [option] = await productProductOptionRepository.find({ productId, optionId })
    if (!option) throw new Error(`Expected product "${productId}" to offer option "${optionId}"`)
    const values = await productProductOptionValueRepository.find({ productProductOptionId: option.id })
    return { option, values }
  }

  test('createProductVariant persists the Option Combination', async ({ expect, dto }) => {
    const { product, size, colour, combination } = await createProductWithOptions(dto.generate.createProduct())

    const variant = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Red'),
    })

    const links = await service.listProductVariantOptions({ variantId: variant.id })
    expect(links).toHaveLength(2)
    expect(links.every((link) => link.id.startsWith('pvopt_'))).toBe(true)

    const maps = await service.listVariantOptionMaps([variant.id])
    expect(Object.keys(maps[variant.id] ?? {}).sort()).toEqual([size.id, colour.id].sort())
  })

  test("enrichVariants attaches each variant's Option Combination", async ({ expect, dto }) => {
    const { product, size, colour, combination } = await createProductWithOptions(dto.generate.createProduct())
    const withOptions = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Red'),
    })
    // Cleared rather than created bare: a create has to name every option, so an empty
    // combination is only reachable through an update.
    const withoutOptions = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('M', 'Blue'),
    })
    await service.updateProductVariant(withoutOptions.id, { optionValues: {} })

    const enriched = await service.enrichVariants([withOptions, withoutOptions])

    // Resolved and in the product's option order, so the admin renders it without joining back
    // against the product.
    expect(enriched[0]?.optionValues).toEqual([
      { optionId: size.id, optionTitle: size.title, valueId: combination('S', 'Red')[size.id], value: 'S' },
      { optionId: colour.id, optionTitle: colour.title, valueId: combination('S', 'Red')[colour.id], value: 'Red' },
    ])
    // A variant carrying nothing gets an empty list rather than a missing key.
    expect(enriched[1]?.optionValues).toEqual([])
    // The scalar fields survive the spread.
    expect(enriched[0]?.title).toBe('S / Red')
  })

  test('listVariantOptionMaps gives the storefront the lean id map', async ({ expect, dto }) => {
    const { product, size, colour, combination } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Red'),
    })
    const bare = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('M', 'Blue'),
    })
    await service.updateProductVariant(bare.id, { optionValues: {} })

    const maps = await service.listVariantOptionMaps([variant.id, bare.id])

    expect(maps[variant.id]).toEqual({
      [size.id]: combination('S', 'Red')[size.id],
      [colour.id]: combination('S', 'Red')[colour.id],
    })
    // Present with an empty map rather than absent, so callers need no fallback.
    expect(maps[bare.id]).toEqual({})
  })

  test('a variant title defaults to its combination label', async ({ expect, dto }) => {
    const { product, combination } = await createProductWithOptions(dto.generate.createProduct())

    const variant = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Red'),
    })

    expect(variant.title).toBe('S / Red')
  })

  test('a variant of a product with no options is titled after the product', async ({ expect, dto }) => {
    // The combination's label is empty, and the column is NOT NULL — the product's own name is
    // the only thing left that identifies the variant on a line item.
    const product = await service.createProduct({ ...dto.generate.createProduct(), title: 'Enamel Mug' })

    const variant = await service.createProductVariant({ productId: product.id, optionValues: {} })

    expect(variant.title).toBe('Enamel Mug')
  })

  test('renaming an option value retitles every variant carrying it', async ({ expect, dto }) => {
    // Titles are derived, so a value rename that left them alone would make "derived" a lie.
    const { product, colour, size, combination } = await createProductWithOptions(dto.generate.createProduct())
    const red = colour.values.find((value) => value.value === 'Red')
    if (!red) throw new Error('Expected the Colour option to carry a Red value')

    const carrying = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Red'),
    })
    const untouched = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Blue'),
    })

    await service.updateProductOption(colour.id, {
      values: colour.values.map((value) => ({ id: value.id, value: value.id === red.id ? 'Crimson' : value.value })),
    })

    expect((await service.retrieveProductVariant(carrying.id)).title).toBe('S / Crimson')
    expect((await service.retrieveProductVariant(untouched.id)).title).toBe('S / Blue')
    expect(size.values.length).toBeGreaterThan(0)
  })

  test('renaming an option value keeps the value id, so combinations survive', async ({ expect, dto }) => {
    // A rename used to be a delete plus an insert, which both broke every variant link and was
    // refused outright once a product used the value.
    const { product, colour, combination } = await createProductWithOptions(dto.generate.createProduct())
    const red = colour.values.find((value) => value.value === 'Red')
    if (!red) throw new Error('Expected the Colour option to carry a Red value')
    const variant = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Red'),
    })

    await service.updateProductOption(colour.id, {
      values: colour.values.map((value) => ({ id: value.id, value: value.id === red.id ? 'Crimson' : value.value })),
    })

    const maps = await service.listVariantOptionMaps([variant.id])
    expect(maps[variant.id]?.[colour.id]).toBe(red.id)
  })

  test('changing the combination without a title retitles the variant', async ({ expect, dto }) => {
    // Otherwise a variant moved from S/Red to M/Blue would keep advertising itself as S/Red, and
    // that stale name is copied onto cart line items and order history.
    const { product, combination } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Red'),
    })

    const updated = await service.updateProductVariant(variant.id, { optionValues: combination('M', 'Blue') })

    expect(updated.title).toBe('M / Blue')
  })

  test('listProductOptionCombinations marks taken combinations and leaves the rest free', async ({ expect, dto }) => {
    const { product, combination } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Red'),
    })

    const { combinations, count, totalCombinations, availableCombinations } =
      await service.listProductOptionCombinations({ productId: product.id })

    // Two sizes times two colours.
    expect(count).toBe(4)
    expect(totalCombinations).toBe(4)
    expect(availableCombinations).toBe(3)
    expect(combinations.find((entry) => entry.label === 'S / Red')?.variantId).toBe(variant.id)
    expect(combinations.filter((entry) => entry.variantId === null)).toHaveLength(3)
  })

  test('scope available drops taken combinations but keeps the named variant its own', async ({ expect, dto }) => {
    const { product, combination } = await createProductWithOptions(dto.generate.createProduct())
    const mine = await service.createProductVariant({ productId: product.id, optionValues: combination('S', 'Red') })
    await service.createProductVariant({ productId: product.id, optionValues: combination('M', 'Red') })

    const others = await service.listProductOptionCombinations({ productId: product.id, scope: 'available' })
    const forMine = await service.listProductOptionCombinations({
      productId: product.id,
      scope: 'available',
      variantId: mine.id,
    })

    expect(others.combinations.map((entry) => entry.label).sort()).toEqual(['M / Blue', 'S / Blue'])
    expect(others.count).toBe(2)
    expect(forMine.combinations.map((entry) => entry.label).sort()).toEqual(['M / Blue', 'S / Blue', 'S / Red'])
    expect(forMine.availableCombinations).toBe(3)
    // The totals describe the product, so scoping never moves them.
    expect(forMine.totalCombinations).toBe(4)
  })

  test('a label that matches nothing leaves the product totals intact', async ({ expect, dto }) => {
    const { product } = await createProductWithOptions(dto.generate.createProduct())

    const page = await service.listProductOptionCombinations({ productId: product.id, label: 'chartreuse' })

    // The difference the create form reads: no matches is not the same as no options.
    expect(page.combinations).toEqual([])
    expect(page.count).toBe(0)
    expect(page.totalCombinations).toBe(4)
    expect(page.availableCombinations).toBe(4)
  })

  test('listProductOptionCombinations filters by label and still reports the full match count', async ({
    expect,
    dto,
  }) => {
    const { product } = await createProductWithOptions(dto.generate.createProduct())

    const { combinations, count } = await service.listProductOptionCombinations({ productId: product.id, label: 'red' })

    // Case-insensitive, and the count is of matches rather than of the whole matrix.
    expect(count).toBe(2)
    expect(combinations.map((entry) => entry.label).sort()).toEqual(['M / Red', 'S / Red'])
  })

  test('listProductOptionCombinations paginates', async ({ expect, dto }) => {
    const { product } = await createProductWithOptions(dto.generate.createProduct())

    const { combinations, count } = await service.listProductOptionCombinations(
      { productId: product.id },
      { offset: 1, limit: 2 },
    )

    expect(count).toBe(4)
    expect(combinations).toHaveLength(2)
  })

  test('a product with no options offers no combinations', async ({ expect, dto }) => {
    const product = await service.createProduct(dto.generate.createProduct())

    expect(await service.listProductOptionCombinations({ productId: product.id })).toEqual({
      combinations: [],
      count: 0,
      totalCombinations: 0,
      availableCombinations: 0,
    })
  })

  test('buildProductPickerTargets sends a value to the variant that carries it', async ({ expect, dto }) => {
    const { product, size, colour, combination } = await createProductWithOptions(dto.generate.createProduct())
    const red = await service.createProductVariant({ productId: product.id, optionValues: combination('S', 'Red') })
    const blue = await service.createProductVariant({ productId: product.id, optionValues: combination('S', 'Blue') })

    const targets = await service.buildProductPickerTargets(product.id, [
      { id: red.id, optionValues: combination('S', 'Red'), inStock: true },
      { id: blue.id, optionValues: combination('S', 'Blue'), inStock: true },
    ])

    const pick = (values: Record<string, string>, optionId: string) => {
      const found = values[optionId]
      if (!found) throw new Error(`Expected a value for option ${optionId}`)
      return found
    }
    // Sitting on the red one: red points at itself so it renders as selected, blue navigates away.
    expect(targets[red.id]?.[pick(combination('S', 'Red'), colour.id)]).toBe(red.id)
    expect(targets[red.id]?.[pick(combination('S', 'Blue'), colour.id)]).toBe(blue.id)
    // No variant carries M, so that value is unreachable.
    expect(targets[red.id]?.[pick(combination('M', 'Red'), size.id)]).toBeNull()
  })

  test('enrichVariants on an empty list makes no query', async ({ expect }) => {
    expect(await service.enrichVariants([])).toEqual([])
  })

  test('listOptionValuesForVariant resolves the values a variant carries', async ({ expect, dto }) => {
    const { product, combination } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('M', 'Blue'),
    })

    const values = await service.listOptionValuesForVariant(variant.id)

    expect(values.map((value) => value.value).sort()).toEqual(['Blue', 'M'])
  })

  test('updating with optionValues replaces the combination', async ({ expect, dto }) => {
    const { product, colour, combination } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Red'),
    })

    await service.updateProductVariant(variant.id, { optionValues: combination('S', 'Blue') })

    const values = await service.listOptionValuesForVariant(variant.id)
    expect(values.map((value) => value.value).sort()).toEqual(['Blue', 'S'])
    const maps = await service.listVariantOptionMaps([variant.id])
    expect(Object.keys(maps[variant.id] ?? {})).toHaveLength(2)
    expect(maps[variant.id]?.[colour.id]).toBe(combination('S', 'Blue')[colour.id])
  })

  test('one combination cannot be moved onto several variants at once', async ({ expect, dto }) => {
    const { product, combination } = await createProductWithOptions(dto.generate.createProduct())
    const first = await service.createProductVariant({ productId: product.id, optionValues: combination('S', 'Red') })
    const second = await service.createProductVariant({ productId: product.id, optionValues: combination('M', 'Blue') })

    const error = await service
      .updateProductVariants([first.id, second.id], { optionValues: combination('S', 'Blue') })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.INVALID_DATA)
    expect(error.message).toContain('cannot be assigned to several at once')
    // Nothing was written on the way to the error.
    const values = await service.listOptionValuesForVariant(first.id)
    expect(values.map((value) => value.value).sort()).toEqual(['Red', 'S'])
  })

  test('updating without optionValues leaves the combination untouched', async ({ expect, dto }) => {
    const { product, combination } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Red'),
    })

    await service.updateProductVariant(variant.id, { sku: 'RENAMED' })

    const values = await service.listOptionValuesForVariant(variant.id)
    expect(values.map((value) => value.value).sort()).toEqual(['Red', 'S'])
  })

  test('an empty optionValues map clears the combination', async ({ expect, dto }) => {
    const { product, combination } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Red'),
    })

    await service.updateProductVariant(variant.id, { optionValues: {} })

    expect(await service.listProductVariantOptions({ variantId: variant.id })).toEqual([])
  })

  test('a mixed batch only touches the variants that carry a combination', async ({ expect, dto }) => {
    const { product, combination } = await createProductWithOptions(dto.generate.createProduct())
    const untouched = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('M', 'Blue'),
    })

    await service.upsertProductVariants([
      { productId: product.id, optionValues: combination('S', 'Red') },
      { id: untouched.id, sku: 'SKU-ONLY' },
    ])

    const values = await service.listOptionValuesForVariant(untouched.id)
    expect(values.map((value) => value.value).sort()).toEqual(['Blue', 'M'])
  })

  test('a partial combination is rejected', async ({ expect, dto }) => {
    const { product, size } = await createProductWithOptions(dto.generate.createProduct())
    const smallId = size.values.find((value) => value.value === 'S')?.id
    if (!smallId) throw new Error('Expected the Size option to carry an S value')

    const error = await service
      .createProductVariant({ productId: product.id, optionValues: { [size.id]: smallId } })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.INVALID_DATA)
    expect(error.message).toContain('Product has 2 option(s) but 1 option value(s) were provided')
  })

  test('a create with no combination at all is rejected', async ({ expect, dto }) => {
    const { product } = await createProductWithOptions(dto.generate.createProduct())

    const error = await service.createProductVariant({ productId: product.id, optionValues: {} }).catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.INVALID_DATA)
    expect(error.message).toContain('Product has 2 option(s) but 0 option value(s) were provided')
  })

  test('a product with no options takes a variant with an empty combination', async ({ expect, dto }) => {
    const product = await service.createProduct({ ...dto.generate.createProduct(), title: 'Enamel Mug' })

    const variant = await service.createProductVariant({ productId: product.id, optionValues: {} })

    expect(variant.title).toBe('Enamel Mug')
    expect(await service.listProductVariantOptions({ variantId: variant.id })).toEqual([])
  })

  test('a value the product does not offer is rejected', async ({ expect, dto }) => {
    const { product, size, colour, combination } = await createProductWithOptions(dto.generate.createProduct())
    // Narrow the product to Red only, so Blue exists on the option but not on this product.
    await service.setProductOptions(product.id, {
      options: [
        { optionId: size.id, valueIds: size.values.map((value) => value.id) },
        { optionId: colour.id, valueIds: [colour.values.filter((value) => value.value === 'Red')[0]?.id ?? ''] },
      ],
    })

    const error = await service
      .createProductVariant({ productId: product.id, optionValues: combination('S', 'Blue') })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.INVALID_DATA)
    expect(error.message).toContain('does not exist for option')
  })

  test('two variants in one batch cannot claim the same combination', async ({ expect, dto }) => {
    const { product, combination } = await createProductWithOptions(dto.generate.createProduct())

    const error = await service
      .createProductVariants([
        { productId: product.id, optionValues: combination('S', 'Red') },
        { productId: product.id, optionValues: combination('S', 'Red') },
      ])
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.INVALID_DATA)
    expect(error.message).toContain('has the same combination of option values as')
  })

  test('a combination already on the product is rejected', async ({ expect, dto }) => {
    const { product, combination } = await createProductWithOptions(dto.generate.createProduct())
    await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Red'),
    })

    const error = await service
      .createProductVariant({ productId: product.id, optionValues: combination('S', 'Red') })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.INVALID_DATA)
    expect(error.message).toContain('with the provided options already exists')
  })

  test('re-sending a variant its own combination is not a collision', async ({ expect, dto }) => {
    const { product, combination } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Red'),
    })

    await service.updateProductVariant(variant.id, { optionValues: combination('S', 'Red') })

    const values = await service.listOptionValuesForVariant(variant.id)
    expect(values.map((value) => value.value).sort()).toEqual(['Red', 'S'])
  })

  // I1 — unenforced while `product_product_option_id` is off the pivot; there is nothing to index
  // "one value per option per variant" on. Skipped rather than deleted: it is the assertion that
  // proves the rule when the column returns. See the TODO in
  // `.scratch/soft-delete-cascade/issues/06-layered-product-option-schema.md`.
  test.skip('two values of the same option cannot both be assigned', async ({ expect, dto }) => {
    const { product, size, combination } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('M', 'Blue'),
    })
    await service.updateProductVariant(variant.id, { optionValues: {} })

    const offered = await productOptionRowsFor(product.id, size.id)
    const [small, medium] = offered.values
    if (!small || !medium) throw new Error('Expected the Size option to carry two values')

    // Straight at the repository, since the DTO's map shape makes this unrepresentable.
    await productVariantOptionRepository.create({ variantId: variant.id, productProductOptionValueId: small.id })

    await expect(
      productVariantOptionRepository.create({ variantId: variant.id, productProductOptionValueId: medium.id }),
    ).rejects.toThrow()
  })

  test('softDeleteProductVariants releases the option links and nothing above them', async ({ expect, dto }) => {
    const { product, size, colour, combination } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({
      productId: product.id,
      optionValues: combination('S', 'Red'),
    })

    await service.softDeleteProductVariants([variant.id])

    expect(await service.listProductVariantOptions({ variantId: variant.id })).toEqual([])
    // D5: a variant owns its option values and nothing else. Both layers above it are untouched —
    // the product still offers what it offered, and the shop's catalogue is unchanged.
    const offered = await service.listProductOptionsForProduct(product.id)
    expect(offered.map((option) => option.id)).toEqual([size.id, colour.id])
    expect(offered.flatMap((option) => option.values)).toHaveLength(4)
    expect(await service.listProductOptions({ id: [size.id, colour.id] })).toHaveLength(2)
  })

  test('planProductOptionChange removes the variants carrying a dropped value', async ({ expect, dto }) => {
    const { product, size, colour, combination } = await createProductWithOptions(dto.generate.createProduct())
    const doomed = await service.createProductVariant({ productId: product.id, optionValues: combination('S', 'Red') })
    const kept = await service.createProductVariant({ productId: product.id, optionValues: combination('S', 'Blue') })
    const blue = colour.values.find((value) => value.value === 'Blue')
    if (!blue) throw new Error('Expected the Colour option to carry a Blue value')

    const plan = await service.planProductOptionChange(product.id, {
      options: [
        { optionId: size.id, valueIds: size.values.map((value) => value.id) },
        { optionId: colour.id, valueIds: [blue.id] },
      ],
    })

    expect(plan.remove).toEqual([{ variantId: doomed.id, title: 'S / Red', reason: 'value-dropped' }])
    expect(plan.keep.map((entry) => entry.variantId)).toContain(kept.id)
  })

  test('planProductOptionChange collapses variants onto the oldest when an option is dropped', async ({
    expect,
    dto,
  }) => {
    const { product, size, combination } = await createProductWithOptions(dto.generate.createProduct())
    const oldest = await service.createProductVariant({ productId: product.id, optionValues: combination('S', 'Red') })
    const doomed = await service.createProductVariant({ productId: product.id, optionValues: combination('S', 'Blue') })

    const plan = await service.planProductOptionChange(product.id, {
      options: [{ optionId: size.id, valueIds: size.values.map((value) => value.id) }],
    })

    expect(plan.reassign.map((entry) => entry.variantId)).toContain(oldest.id)
    expect(plan.remove).toEqual([{ variantId: doomed.id, title: 'S / Blue', reason: 'collapsed' }])
  })

  test('dropping every option collapses the matrix back to one option-less variant', async ({ expect, dto }) => {
    // The round trip a shopkeeper actually makes: create without variations, add options, then
    // change their mind. Without the collapse they are left with one nameless duplicate per
    // combination, each titled after the product.
    const { product, size, colour, combination } = await createProductWithOptions(dto.generate.createProduct())
    await service.createProductVariant({ productId: product.id, optionValues: combination('S', 'Red') })
    await service.createProductVariant({ productId: product.id, optionValues: combination('S', 'Blue') })
    await service.createProductVariant({ productId: product.id, optionValues: combination('M', 'Red') })
    await service.createProductVariant({ productId: product.id, optionValues: combination('M', 'Blue') })

    const plan = await service.planProductOptionChange(product.id, { options: [] })

    expect(plan.reassign).toHaveLength(1)
    expect(plan.remove).toHaveLength(3)
    expect(plan.remove.every((entry) => entry.reason === 'collapsed')).toBe(true)
    expect(plan.keep).toEqual([])
    expect(size.values.length + colour.values.length).toBeGreaterThan(0)
  })

  test('planProductOptionChange refuses to leave the product above the variant ceiling', async ({ expect, dto }) => {
    const { product, size, colour } = await createProductWithOptions(dto.generate.createProduct())
    // A ceiling on writing variants, not on enumerating combinations — the two limits differ.
    const wide = await service.createProductOption({
      title: `Wide-${product.id}`,
      values: Array.from({ length: 300 }, (_unused, index) => ({ value: `w${index}` })),
    })

    const error = await service
      .planProductOptionChange(product.id, {
        options: [
          { optionId: size.id, valueIds: size.values.map((value) => value.id) },
          { optionId: colour.id, valueIds: colour.values.map((value) => value.id) },
          { optionId: wide.id, valueIds: wide.values.map((value) => value.id) },
        ],
      })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.NOT_ALLOWED)
    expect(error.message).toContain('above the limit of')
  })

  test('setProductOptions applies a change its variants can follow, and moves them', async ({ expect, dto }) => {
    // The refusal is not "the variants would have to move" — that is the ordinary case, and
    // refusing it would make dropping an option impossible on any product that sells. It is
    // "a variant would have nowhere to be", which this change does not produce: one variant
    // dropping Colour lands on S, which nothing else holds.
    const { product, size, combination } = await createProductWithOptions(dto.generate.createProduct())
    const variant = await service.createProductVariant({ productId: product.id, optionValues: combination('S', 'Red') })

    await service.setProductOptions(product.id, {
      options: [{ optionId: size.id, valueIds: size.values.map((value) => value.id) }],
    })

    expect((await service.listProductOptionsForProduct(product.id)).map((option) => option.id)).toEqual([size.id])
    // The variant followed rather than being left standing for a combination that no longer exists.
    const maps = await service.listVariantOptionMaps([variant.id])
    expect(maps[variant.id]).toEqual({ [size.id]: combination('S', 'Red')[size.id] })
    expect((await service.retrieveProductVariant(variant.id)).title).toBe('S')
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

  // ---------------------------------------------------------------------------
  // Cascade delete
  //
  // The product graph is the only one in the schema with a diamond — variant images hang off
  // variants and off product images, both of which hang off the product — and the only one with
  // a restrict relationship. These assert what a later read returns, never how the walk got there.
  // ---------------------------------------------------------------------------

  test.describe('Cascade delete', () => {
    /** A product whose variant image is reachable through the variant *and* through the image. */
    const createProductWithAVariantImage = async (
      draft: CreateProductDTO,
      linkImage: (overrides: VariantImageInput) => VariantImageInput,
    ) => {
      const product = await service.createProduct({ ...draft, images: [{ url: 'https://cdn.test/a.png' }] })
      const [image] = await service.listProductImages({ productId: product.id })
      if (!image) throw new Error('expected the product to have an image')

      const variant = await service.createProductVariant({ productId: product.id, optionValues: {} })
      await service.addImageToVariant([linkImage({ imageId: image.id, variantId: variant.id })])

      return { product, image, variant }
    }

    test('softDeleteProducts — hides the variant images reachable by both paths', async ({ expect, dto }) => {
      const { product, variant } = await createProductWithAVariantImage(
        dto.generate.createProduct(),
        dto.generate.variantImageInput,
      )

      await service.softDeleteProducts([product.id])

      expect(await service.listProductVariants({ productId: product.id })).toHaveLength(0)
      expect(await service.listProductImages({ productId: product.id })).toHaveLength(0)
      expect(await service.listProductVariantImages({ variantId: variant.id })).toHaveLength(0)
    })

    test('restoring a product brings the variant images back exactly once', async ({ expect, dto }) => {
      const { product, variant } = await createProductWithAVariantImage(
        dto.generate.createProduct(),
        dto.generate.variantImageInput,
      )

      await service.softDeleteProducts([product.id])
      // The product module has no restore verb yet, so this reaches the repository directly.
      await productRepository.restore([product.id])

      expect(await service.listProductVariants({ productId: product.id })).toHaveLength(1)
      expect(await service.listProductImages({ productId: product.id })).toHaveLength(1)
      expect(await service.listProductVariantImages({ variantId: variant.id })).toHaveLength(1)
    })

    test('softDeleteProducts — hides the option links two hops down', async ({ expect, dto }) => {
      const product = await service.createProduct(dto.generate.createProduct())
      const size = await service.createProductOption({
        title: `Size-${product.id}`,
        values: [{ value: 'S' }, { value: 'M' }],
      })
      await service.setProductOptions(product.id, {
        options: [{ optionId: size.id, valueIds: size.values.map((value) => value.id) }],
      })
      const small = size.values.find((value) => value.value === 'S')
      if (!small) throw new Error('expected the option to carry the value "S"')
      const variant = await service.createProductVariant({
        productId: product.id,
        optionValues: { [size.id]: small.id },
      })

      await service.softDeleteProducts([product.id])

      expect(await service.listProductVariantOptions({ variantId: variant.id })).toHaveLength(0)
      expect(await service.listProductOptionsForProduct(product.id)).toHaveLength(0)
      // The option itself is shared, not owned: it survives the product that offered it.
      expect(await service.listProductOptions({ id: size.id })).toHaveLength(1)
    })

    test('softDeleteProductOptions — refuses an option a product still offers', async ({ expect, dto }) => {
      const product = await service.createProduct(dto.generate.createProduct())
      const size = await service.createProductOption({ title: `Size-${product.id}`, values: [{ value: 'S' }] })
      await service.setProductOptions(product.id, {
        options: [{ optionId: size.id, valueIds: size.values.map((value) => value.id) }],
      })

      const error = await service.softDeleteProductOptions([size.id]).catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.NOT_ALLOWED)
      // The shopkeeper-facing wording: it says what to do, not which table objected.
      expect(error.message).toContain('Remove them from all products first')
      expect(await service.listProductOptions({ id: size.id })).toHaveLength(1)
    })

    test('the walker refuses it too, naming the relationship that blocked it', async ({ expect, dto }) => {
      const product = await service.createProduct(dto.generate.createProduct())
      const size = await service.createProductOption({ title: `Size-${product.id}`, values: [{ value: 'S' }] })
      await service.setProductOptions(product.id, {
        options: [{ optionId: size.id, valueIds: size.values.map((value) => value.id) }],
      })

      // Straight at the repository, past the service's pre-check: this is the backstop that holds
      // when a future caller forgets to write one.
      const error = await productOptionRepository.softDelete([size.id]).catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.NOT_ALLOWED)
      expect(error.message).toContain('product_product_option.option_id')
      expect(await service.listProductOptions({ id: size.id })).toHaveLength(1)
    })

    test('a global option value a product offers cannot be deleted', async ({ expect, dto }) => {
      const product = await service.createProduct(dto.generate.createProduct())
      const size = await service.createProductOption({
        title: `Size-${product.id}`,
        values: [{ value: 'S' }, { value: 'M' }],
      })
      await service.setProductOptions(product.id, {
        options: [{ optionId: size.id, valueIds: size.values.map((value) => value.id) }],
      })
      const small = size.values.find((value) => value.value === 'S')
      if (!small) throw new Error('expected the option to carry the value "S"')
      await service.createProductVariant({ productId: product.id, optionValues: { [size.id]: small.id } })

      // Straight at the repository, past the service's own product-level pre-check: a product
      // selling something in size S is what makes the value un-removable, and that holds however
      // it is reached. The variant guards the row below it, which is what guards this one.
      const error = await productOptionValueRepository.softDelete([small.id]).catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.NOT_ALLOWED)
      expect(error.message).toContain('product_product_option_value.option_value_id')
      expect(await service.listProductOptionValues({ id: small.id })).toHaveLength(1)
    })

    test('the same value is deletable once no product offers it', async ({ expect, dto }) => {
      const product = await service.createProduct(dto.generate.createProduct())
      const size = await service.createProductOption({
        title: `Size-${product.id}`,
        values: [{ value: 'S' }, { value: 'M' }],
      })
      await service.setProductOptions(product.id, {
        options: [{ optionId: size.id, valueIds: size.values.map((value) => value.id) }],
      })
      const small = size.values.find((value) => value.value === 'S')
      if (!small) throw new Error('expected the option to carry the value "S"')
      const variant = await service.createProductVariant({
        productId: product.id,
        optionValues: { [size.id]: small.id },
      })

      const medium = size.values.find((value) => value.value === 'M')
      if (!medium) throw new Error('expected the option to carry the value "M"')

      // Removing the variant is not enough — the product still offers S. It is the product
      // dropping the value that releases it, which is why `replaceOptionValues` tells the
      // shopkeeper to unlink it from every product first.
      await service.softDeleteProductVariants([variant.id])
      await expect(productOptionValueRepository.softDelete([small.id])).rejects.toThrow()

      await service.setProductOptions(product.id, { options: [{ optionId: size.id, valueIds: [medium.id] }] })
      await productOptionValueRepository.softDelete([small.id])

      expect(await service.listProductOptionValues({ id: small.id })).toHaveLength(0)
    })

    test('a hard delete blocked by the database reports the same not-allowed shape', async ({ expect, dto }) => {
      const product = await service.createProduct(dto.generate.createProduct())
      const size = await service.createProductOption({ title: `Size-${product.id}`, values: [{ value: 'S' }] })
      await service.setProductOptions(product.id, {
        options: [{ optionId: size.id, valueIds: size.values.map((value) => value.id) }],
      })

      // Postgres raises one code for both directions of a foreign-key violation. This is the
      // delete direction, which used to be reported as a 404 for a row that plainly exists.
      const error = await productOptionRepository.delete([size.id]).catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.NOT_ALLOWED)
      expect(error.message).toContain('product_product_option')
    })

    test('an insert naming a parent that does not exist is still a not-found', async ({ expect }) => {
      const error = await service
        .createProductVariant({ productId: 'prod_does_not_exist', optionValues: {} })
        .catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.NOT_FOUND)
    })
  })

  /**
   * The rules the layered schema exists to make expressible, each asserted through what a later
   * read returns. Named D1-D6 and I1-I5 after `docs/product-options.md`, which is where they are
   * written down and where the ones covered elsewhere in this file are cross-referenced.
   */
  test.describe('the product option layer', () => {
    /** A product offering Size (S/M), and a variant that is size S. */
    const productSellingOneSize = async (draft: CreateProductDTO) => {
      const product = await service.createProduct(draft)
      const size = await service.createProductOption({
        title: `Size-${product.id}`,
        values: [{ value: 'S' }, { value: 'M' }],
      })
      const [small, medium] = size.values
      if (!small || !medium) throw new Error('Expected the Size option to carry two values')

      await service.setProductOptions(product.id, { options: [{ optionId: size.id, valueIds: [small.id] }] })
      const variant = await service.createProductVariant({
        productId: product.id,
        optionValues: { [size.id]: small.id },
      })

      return { product, size, small, medium, variant }
    }

    // D3
    test('deleting a product option takes its values and the variant values under it', async ({ expect, dto }) => {
      const { product, size, variant } = await productSellingOneSize(dto.generate.createProduct())
      const offered = await productOptionRowsFor(product.id, size.id)

      await productProductOptionRepository.softDelete([offered.option.id])

      expect(await productProductOptionValueRepository.find({ productProductOptionId: offered.option.id })).toEqual([])
      expect(await service.listProductVariantOptions({ variantId: variant.id })).toEqual([])
      // The global layer is untouched — the option is still in the shop's catalogue.
      expect(await service.listProductOptions({ id: size.id })).toHaveLength(1)
    })

    // D4
    test('deleting a product value takes the variant values carrying it', async ({ expect, dto }) => {
      const { product, size, small, variant } = await productSellingOneSize(dto.generate.createProduct())
      const offered = await productOptionRowsFor(product.id, size.id)
      const [offeredSmall] = offered.values
      if (!offeredSmall) throw new Error('Expected the product to offer one value')

      await productProductOptionValueRepository.softDelete([offeredSmall.id])

      expect(await service.listProductVariantOptions({ variantId: variant.id })).toEqual([])
      // The option the product offers survives, and so does the global value.
      expect(await productProductOptionRepository.find({ id: offered.option.id })).toHaveLength(1)
      expect(await service.listProductOptionValues({ id: small.id })).toHaveLength(1)
    })

    // I5 — nothing enforces this while the composite foreign keys are out. Skipped rather than
    // deleted: it is the assertion that proves the rule when they come back. See the TODO in
    // `.scratch/soft-delete-cascade/issues/06-layered-product-option-schema.md`.
    test.skip('a variant cannot carry an option its own product does not offer', async ({ expect, dto }) => {
      const mine = await productSellingOneSize(dto.generate.createProduct())
      const theirs = await productSellingOneSize(dto.generate.createProduct())
      const borrowed = await productOptionRowsFor(theirs.product.id, theirs.size.id)
      const [borrowedValue] = borrowed.values
      if (!borrowedValue) throw new Error('Expected the other product to offer one value')

      // Straight at the repository: no resolver will build this, which is the point — the
      // composite keys mean it cannot be written even by something that skips them.
      const error = await productVariantOptionRepository
        .create({ variantId: mine.variant.id, productProductOptionValueId: borrowedValue.id })
        .catch((e) => e)

      // The pair (that option, this product) is not a row, so the composite key reports the
      // insert direction of a foreign-key violation — distinct from I1's unique index, which is
      // what would fire if the row were merely a duplicate.
      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.NOT_FOUND)
      // And the read afterwards still shows the variant carrying only its own product's value.
      const carried = await service.listProductVariantOptions({ variantId: mine.variant.id })
      expect(carried).toHaveLength(1)
    })

    // I1, second half: the denormalised option cannot disagree with the value it accompanies.
    // Skipped for the same reason as the I5 test above — the tie is a composite foreign key.
    //
    // NOTE: the body below no longer expresses the rule, because there is no option column to put
    // in disagreement. Restoring it means naming `product.id`'s Size option alongside the Colour
    // value again, as `productOptionRowsFor(product.id, size.id)` used to provide.
    test.skip('a variant value cannot name an option other than its own', async ({ expect, dto }) => {
      const product = await service.createProduct(dto.generate.createProduct())
      const size = await service.createProductOption({ title: `Size-${product.id}`, values: [{ value: 'S' }] })
      const colour = await service.createProductOption({ title: `Colour-${product.id}`, values: [{ value: 'Red' }] })
      await service.setProductOptions(product.id, {
        options: [
          { optionId: size.id, valueIds: size.values.map((value) => value.id) },
          { optionId: colour.id, valueIds: colour.values.map((value) => value.id) },
        ],
      })
      const [small] = size.values
      const [red] = colour.values
      if (!small || !red) throw new Error('Expected both options to carry a value')
      const variant = await service.createProductVariant({
        productId: product.id,
        optionValues: { [size.id]: small.id, [colour.id]: red.id },
      })
      // Cleared first, so what refuses the write below is the mismatch rather than I1's index.
      await service.updateProductVariant(variant.id, { optionValues: {} })

      const [offeredRed] = (await productOptionRowsFor(product.id, colour.id)).values
      if (!offeredRed) throw new Error('Expected the product to offer Red')

      const error = await productVariantOptionRepository
        .create({ variantId: variant.id, productProductOptionValueId: offeredRed.id })
        .catch((e) => e)

      // The composite key back to the value's own option is what refuses it, not I1's index —
      // the pair (Red, the Size option) is not a row, so it reads as a missing reference.
      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.NOT_FOUND)
      expect(await service.listProductVariantOptions({ variantId: variant.id })).toEqual([])
    })

    // I4
    test('an option a product offers must offer at least one value', async ({ expect, dto }) => {
      const product = await service.createProduct(dto.generate.createProduct())
      const size = await service.createProductOption({ title: `Size-${product.id}`, values: [{ value: 'S' }] })

      const error = await service
        .setProductOptions(product.id, { options: [{ optionId: size.id, valueIds: [] }] })
        .catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.INVALID_DATA)
      expect(await service.listProductOptionsForProduct(product.id)).toEqual([])
    })

    // I3 on the deletion path: dropping a value would leave a variant partial
    test('setProductOptions refuses a change that strands a variant', async ({ expect, dto }) => {
      const { product, size, medium, variant } = await productSellingOneSize(dto.generate.createProduct())

      const error = await service
        .setProductOptions(product.id, { options: [{ optionId: size.id, valueIds: [medium.id] }] })
        .catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.NOT_ALLOWED)
      expect(error.message).toContain('carries a value it removes')
      // Nothing was written: the product still offers S and the variant still is one.
      expect((await service.listProductOptionsForProduct(product.id))[0]?.values).toHaveLength(1)
      expect(await service.listProductVariantOptions({ variantId: variant.id })).toHaveLength(1)
    })

    // I2 on the deletion path: two variants would land on the same combination
    test('dropping an option from a two-variant product is refused', async ({ expect, dto }) => {
      const { product, size, small, medium } = await productSellingOneSize(dto.generate.createProduct())
      await service.setProductOptions(product.id, { options: [{ optionId: size.id, valueIds: [small.id, medium.id] }] })
      await service.createProductVariant({ productId: product.id, optionValues: { [size.id]: medium.id } })

      const error = await service.setProductOptions(product.id, { options: [] }).catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.NOT_ALLOWED)
      expect(error.message).toContain('a combination another variant already has')
      expect(await service.listProductVariants({ productId: product.id })).toHaveLength(2)
    })

    test('dropping it from a single-variant product leaves that variant bare', async ({ expect, dto }) => {
      const { product, variant } = await productSellingOneSize(dto.generate.createProduct())

      await service.setProductOptions(product.id, { options: [] })

      expect(await service.listProductOptionsForProduct(product.id)).toEqual([])
      expect(await service.listProductVariantOptions({ variantId: variant.id })).toEqual([])
      // The ordinary option-less shape: named after its product, since it stands for nothing else.
      const product_ = await service.retrieveProduct(product.id)
      expect((await service.retrieveProductVariant(variant.id)).title).toBe(product_.title)
    })

    test('an unrelated option edit leaves every variant carrying its values', async ({ expect, dto }) => {
      const { product, size, small, medium, variant } = await productSellingOneSize(dto.generate.createProduct())

      // Widening the option is a change the variant covers, so nothing about it should move. Under
      // a wholesale replace the cascade would take its values with the row that was recreated.
      await service.setProductOptions(product.id, { options: [{ optionId: size.id, valueIds: [small.id, medium.id] }] })

      const maps = await service.listVariantOptionMaps([variant.id])
      expect(maps[variant.id]).toEqual({ [size.id]: small.id })
    })

    test('applyProductOptionChange moves what it can and reports what it cannot', async ({ expect, dto }) => {
      const { product, size, small, medium } = await productSellingOneSize(dto.generate.createProduct())
      await service.setProductOptions(product.id, { options: [{ optionId: size.id, valueIds: [small.id, medium.id] }] })
      const doomed = await service.createProductVariant({
        productId: product.id,
        optionValues: { [size.id]: medium.id },
      })

      const { plan, created } = await service.applyProductOptionChange(product.id, { options: [] })

      // The option is gone and the survivor is bare, which `setProductOptions` refused to do.
      expect(await service.listProductOptionsForProduct(product.id)).toEqual([])
      expect(created).toEqual([])
      // The collapsed variant is reported, not removed: that reaches price sets, links and carts.
      expect(plan.remove.map((entry) => entry.variantId)).toEqual([doomed.id])
      expect(await service.listProductVariants({ id: doomed.id })).toHaveLength(1)
    })

    test('revertProductOptionChange puts the options and the combinations back', async ({ expect, dto }) => {
      const { product, size, small, variant } = await productSellingOneSize(dto.generate.createProduct())
      const previousOptions = { options: [{ optionId: size.id, valueIds: [small.id] }] }
      const previousCombinations = [{ variantId: variant.id, optionValues: { [size.id]: small.id } }]

      await service.applyProductOptionChange(product.id, { options: [] })
      await service.revertProductOptionChange(product.id, previousOptions, previousCombinations)

      expect((await service.listProductOptionsForProduct(product.id)).map((option) => option.id)).toEqual([size.id])
      const maps = await service.listVariantOptionMaps([variant.id])
      expect(maps[variant.id]).toEqual({ [size.id]: small.id })
    })
  })
})
