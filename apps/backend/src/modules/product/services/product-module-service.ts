import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type {
  Context,
  CreateProductDTO,
  CreateProductImageDTO,
  CreateProductOptionDTO,
  CreateProductOptionValueDTO,
  CreateProductVariantDTO,
  EnrichedProductVariantDTO,
  FilterableProductImageProps,
  FilterableProductOptionProps,
  FilterableProductOptionValueProps,
  FilterableProductProps,
  FilterableProductVariantImageProps,
  FilterableProductVariantOptionProps,
  FilterableProductVariantProps,
  FindConfig,
  IProductModuleService,
  ProductDTO,
  ProductImageDTO,
  ProductOptionCombinationDTO,
  ProductOptionDTO,
  ProductOptionValueDTO,
  ProductOptionWithValuesDTO,
  ProductScopedOptionDTO,
  ProductVariantDTO,
  ProductVariantImageDTO,
  ProductVariantOptionDTO,
  SetProductOptionsDTO,
  UpdateProductDTO,
  UpdateProductOptionDTO,
  UpdateProductVariantDTO,
  UpsertProductImageInput,
  UpsertProductVariantDTO,
  VariantImageInput,
  VariantOptionValueDTO,
} from '../../../core/types/index.js'
import type { Logger } from '../../../core/types/logger.js'
import { toHandle } from '../../../core/utils/to-handle.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { ProductRepository } from '../repositories/product.js'
import type { ProductImageRepository } from '../repositories/product-image.js'
import type { ProductOptionRepository } from '../repositories/product-option.js'
import type { ProductOptionValueRepository } from '../repositories/product-option-value.js'
import type { ProductProductOptionRepository } from '../repositories/product-product-option.js'
import type { ProductProductOptionValueRepository } from '../repositories/product-product-option-value.js'
import type { ProductVariantRepository } from '../repositories/product-variant.js'
import type { ProductVariantImageRepository } from '../repositories/product-variant-image.js'
import type { ProductVariantOptionRepository } from '../repositories/product-variant-option.js'
import {
  buildCombinations,
  buildPickerTargets,
  countCombinations,
  findCombination,
  MAX_OPTION_COMBINATIONS,
} from '../utils/option-combinations.js'

/** A resolved Option Combination ready to write: the pivot rows, plus the label a title falls back to. */
type ResolvedCombination = {
  links: Array<{ optionId: string; optionValueId: string }>
  label: string
}

type InjectedDependencies = {
  productRepository: ProductRepository
  productVariantRepository: ProductVariantRepository
  productOptionRepository: ProductOptionRepository
  productOptionValueRepository: ProductOptionValueRepository
  productProductOptionRepository: ProductProductOptionRepository
  productProductOptionValueRepository: ProductProductOptionValueRepository
  productImageRepository: ProductImageRepository
  productVariantImageRepository: ProductVariantImageRepository
  productVariantOptionRepository: ProductVariantOptionRepository
  withTransaction: WithTransaction
  logger: Logger
}

export class ProductModuleService implements IProductModuleService {
  private productRepository: ProductRepository
  private productVariantRepository: ProductVariantRepository
  private productOptionRepository: ProductOptionRepository
  private productOptionValueRepository: ProductOptionValueRepository
  private productProductOptionRepository: ProductProductOptionRepository
  private productProductOptionValueRepository: ProductProductOptionValueRepository
  private productImageRepository: ProductImageRepository
  private productVariantImageRepository: ProductVariantImageRepository
  private productVariantOptionRepository: ProductVariantOptionRepository
  private withTransaction: WithTransaction
  private logger: Logger

  constructor({
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
  }: InjectedDependencies) {
    this.productRepository = productRepository
    this.productVariantRepository = productVariantRepository
    this.productOptionRepository = productOptionRepository
    this.productOptionValueRepository = productOptionValueRepository
    this.productProductOptionRepository = productProductOptionRepository
    this.productProductOptionValueRepository = productProductOptionValueRepository
    this.productImageRepository = productImageRepository
    this.productVariantImageRepository = productVariantImageRepository
    this.productVariantOptionRepository = productVariantOptionRepository
    this.withTransaction = withTransaction
    this.logger = logger
  }

  // ── Products ──────────────────────────────────────────────────────────

  async listProducts(
    filters?: FilterableProductProps,
    config?: FindConfig<ProductDTO>,
    context?: Context,
  ): Promise<ProductDTO[]> {
    return this.productRepository.find(filters, config, context)
  }

  async listAndCountProducts(
    filters?: FilterableProductProps,
    config?: FindConfig<ProductDTO>,
    context?: Context,
  ): Promise<[ProductDTO[], number]> {
    return this.productRepository.findAndCount(filters, config, context)
  }

  async retrieveProduct(productId: string, config?: FindConfig<ProductDTO>, context?: Context): Promise<ProductDTO> {
    return this.productRepository.findByIdOrFail(productId, config, context)
  }

  async createProducts(data: CreateProductDTO[], context?: Context): Promise<ProductDTO[]> {
    this.logger.debug(`Creating ${data.length} product(s)`)
    return this.withTransaction(context, async (ctx) => {
      const products = await this.productRepository.createMany(
        data.map(({ images, ...product }) => ({
          ...product,
          handle: product.handle ?? toHandle(product.title),
          thumbnail: this.resolveThumbnail(product, images),
        })),
        ctx,
      )

      await Promise.all(
        products.map((product, index) => {
          const images = data[index]?.images
          return images ? this.replaceProductImages(product.id, images, ctx) : Promise.resolve()
        }),
      )

      return products
    })
  }

  async updateProducts(productIds: string[], data: UpdateProductDTO, context?: Context): Promise<ProductDTO[]> {
    const { images, ...productData } = data
    return this.withTransaction(context, async (ctx) => {
      const changes = { ...productData, thumbnail: this.resolveThumbnail(productData, images) }
      const products = Object.values(changes).some((value) => value !== undefined)
        ? await this.productRepository.updateMany(productIds, changes, ctx)
        : await this.productRepository.find({ id: productIds }, undefined, ctx)

      if (images) {
        await Promise.all(productIds.map((productId) => this.replaceProductImages(productId, images, ctx)))
      }

      return products
    })
  }

  async createProduct(data: CreateProductDTO, context?: Context): Promise<ProductDTO> {
    return this.withTransaction(context, async (ctx) => {
      const { images, ...product } = data
      const created = await this.productRepository.create(
        {
          ...product,
          handle: product.handle ?? toHandle(product.title),
          thumbnail: this.resolveThumbnail(product, images),
        },
        ctx,
      )
      if (images) await this.replaceProductImages(created.id, images, ctx)
      return created
    })
  }

  async updateProduct(productId: string, data: UpdateProductDTO, context?: Context): Promise<ProductDTO> {
    const { images, ...productData } = data
    return this.withTransaction(context, async (ctx) => {
      const changes = { ...productData, thumbnail: this.resolveThumbnail(productData, images) }
      const product = Object.values(changes).some((value) => value !== undefined)
        ? await this.productRepository.update(productId, changes, ctx)
        : await this.productRepository.findByIdOrFail(productId, undefined, ctx)

      if (images) await this.replaceProductImages(productId, images, ctx)

      return product
    })
  }

  async deleteProducts(productIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.productRepository.softDelete(productIds, ctx)
    })
  }

  // ── Variants ──────────────────────────────────────────────────────────

  async createProductVariants(data: CreateProductVariantDTO[], context?: Context): Promise<ProductVariantDTO[]> {
    this.logger.debug(`Creating ${data.length} product variant(s)`)
    return this.withTransaction(context, async (ctx) => {
      const resolved = await this.resolveVariantCombinations(
        data.map((variant) => ({
          productId: variant.productId,
          title: variant.title,
          optionValues: variant.optionValues,
        })),
        ctx,
      )

      const variants = await this.productVariantRepository.createMany(
        data.map(({ optionValues: _optionValues, ...variant }, index) => ({
          ...variant,
          title: this.resolveVariantTitle(variant.title, resolved[index]) ?? '',
        })),
        ctx,
      )

      await Promise.all(
        variants.map((variant, index) => {
          const combination = resolved[index]
          return combination ? this.replaceVariantOptionValues(variant.id, combination.links, ctx) : undefined
        }),
      )

      return variants
    })
  }

  async createProductVariant(data: CreateProductVariantDTO, context?: Context): Promise<ProductVariantDTO> {
    return this.withTransaction(context, async (ctx) => {
      const [variant] = await this.createProductVariants([data], ctx)
      if (!variant)
        throw new AppError({ type: ErrorTypes.UNEXPECTED_STATE, message: 'Variant creation returned no rows' })
      return variant
    })
  }

  async listProductVariants(
    filters?: FilterableProductVariantProps,
    config?: FindConfig<ProductVariantDTO>,
    context?: Context,
  ): Promise<ProductVariantDTO[]> {
    return this.productVariantRepository.find(filters, config, context)
  }

  async listAndCountProductVariants(
    filters?: FilterableProductVariantProps,
    config?: FindConfig<ProductVariantDTO>,
    context?: Context,
  ): Promise<[ProductVariantDTO[], number]> {
    return this.productVariantRepository.findAndCount(filters, config, context)
  }

  async retrieveProductVariant(
    variantId: string,
    config?: FindConfig<ProductVariantDTO>,
    context?: Context,
  ): Promise<ProductVariantDTO> {
    return this.productVariantRepository.findByIdOrFail(variantId, config, context)
  }

  async updateProductVariants(
    variantIds: string[],
    data: UpdateProductVariantDTO,
    context?: Context,
  ): Promise<ProductVariantDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      const { optionValues, ...columns } = data

      // The same combination applied to several variants would collide by definition, so this
      // only makes sense for a single target — which is what every caller does today.
      const existing = await this.productVariantRepository.find({ id: variantIds }, undefined, ctx)
      const resolved = optionValues
        ? await this.resolveVariantCombinations(
            existing.map((variant) => ({ ...variant, optionValues })),
            ctx,
          )
        : []

      // Retitling follows the combination when the caller sends no title of its own, so changing
      // a variant from M/White to L/White does not leave a stale name behind.
      const derivedTitle = this.resolveVariantTitle(columns.title, resolved[0])
      const changes = { ...columns, ...(derivedTitle !== undefined ? { title: derivedTitle } : {}) }

      // An options-only edit has no columns to set, which the repository's UPDATE would reject.
      const variants =
        Object.keys(changes).length > 0
          ? await this.productVariantRepository.updateMany(variantIds, changes, ctx)
          : existing

      await Promise.all(
        variants.map((variant, index) => {
          const combination = resolved[index]
          return combination ? this.replaceVariantOptionValues(variant.id, combination.links, ctx) : undefined
        }),
      )

      return variants
    })
  }

  async updateProductVariant(
    variantId: string,
    data: UpdateProductVariantDTO,
    context?: Context,
  ): Promise<ProductVariantDTO> {
    return this.withTransaction(context, async (ctx) => {
      const [variant] = await this.updateProductVariants([variantId], data, ctx)
      if (!variant) throw new AppError({ type: ErrorTypes.NOT_FOUND, message: `Variant "${variantId}" not found` })
      return variant
    })
  }

  async upsertProductVariants(data: UpsertProductVariantDTO[], context?: Context): Promise<ProductVariantDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      const forCreate = data.filter((variant): variant is CreateProductVariantDTO => !('id' in variant))
      const forUpdate = data.filter((variant): variant is { id: string } & UpdateProductVariantDTO => 'id' in variant)

      const created = forCreate.length > 0 ? await this.createProductVariants(forCreate, ctx) : []
      const updated =
        forUpdate.length > 0
          ? await Promise.all(forUpdate.map((variant) => this.updateProductVariant(variant.id, variant, ctx)))
          : []

      return [...created, ...updated]
    })
  }

  async deleteProductVariants(variantIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      // Option links go with the variant, so a deleted variant stops blocking an option unlink.
      const optionLinks = await this.productVariantOptionRepository.find({ variantId: variantIds }, undefined, ctx)
      if (optionLinks.length > 0) {
        await this.productVariantOptionRepository.softDelete(
          optionLinks.map((link) => link.id),
          ctx,
        )
      }
      await this.productVariantRepository.softDelete(variantIds, ctx)
    })
  }

  // ── Options (global) ─────────────────────────────────────────────────

  async createProductOption(data: CreateProductOptionDTO, context?: Context): Promise<ProductOptionWithValuesDTO> {
    return this.withTransaction(context, async (ctx) => {
      const { values: valueInputs, ...optionData } = data
      const option = await this.productOptionRepository.create(optionData, ctx)
      const values =
        valueInputs && valueInputs.length > 0
          ? await this.productOptionValueRepository.createMany(
              valueInputs.map((v, index) => ({ ...v, optionId: option.id, rank: v.rank ?? index })),
              ctx,
            )
          : []
      return { ...option, values }
    })
  }

  async createProductOptions(data: CreateProductOptionDTO[], context?: Context): Promise<ProductOptionDTO[]> {
    this.logger.debug(`Creating ${data.length} product option(s)`)
    return this.withTransaction(context, async (ctx) => {
      return this.productOptionRepository.createMany(data, ctx)
    })
  }

  async listProductOptions(
    filters?: FilterableProductOptionProps,
    config?: FindConfig<ProductOptionDTO>,
    context?: Context,
  ): Promise<ProductOptionWithValuesDTO[]> {
    const options = await this.productOptionRepository.find(filters, config, context)
    return this.enrichOptionsWithValues(options, context)
  }

  async listAndCountProductOptions(
    filters?: FilterableProductOptionProps,
    config?: FindConfig<ProductOptionDTO>,
    context?: Context,
  ): Promise<[ProductOptionWithValuesDTO[], number]> {
    const [options, count] = await this.productOptionRepository.findAndCount(filters, config, context)
    const enriched = await this.enrichOptionsWithValues(options, context)
    return [enriched, count]
  }

  async retrieveProductOption(optionId: string, context?: Context): Promise<ProductOptionWithValuesDTO> {
    const option = await this.productOptionRepository.findByIdOrFail(optionId, undefined, context)
    const values = await this.productOptionValueRepository.find({ optionId }, { order: { rank: 'ASC' } }, context)
    return { ...option, values }
  }

  async updateProductOption(
    optionId: string,
    data: UpdateProductOptionDTO,
    context?: Context,
  ): Promise<ProductOptionWithValuesDTO> {
    return this.withTransaction(context, async (ctx) => {
      const { values: valueInputs, ...optionData } = data

      const option =
        Object.keys(optionData).length > 0
          ? await this.productOptionRepository.update(optionId, optionData, ctx)
          : await this.productOptionRepository.findByIdOrFail(optionId, undefined, ctx)

      if (valueInputs) {
        const existing = await this.productOptionValueRepository.find({ optionId }, undefined, ctx)

        const newValueStrings = new Set(valueInputs.map((v) => v.value))
        const removedValues = existing.filter((v) => !newValueStrings.has(v.value))

        if (removedValues.length > 0) {
          const removedValueIds = removedValues.map((v) => v.id)
          const activeValueLinks = await this.productProductOptionValueRepository.find(
            { optionValueId: removedValueIds },
            undefined,
            ctx,
          )
          if (activeValueLinks.length > 0) {
            throw new AppError({
              type: ErrorTypes.NOT_ALLOWED,
              message:
                'Cannot remove option value(s) that are currently used by products. Remove them from all products first.',
            })
          }
        }

        if (existing.length > 0) {
          await this.productOptionValueRepository.softDelete(
            existing.map((v) => v.id),
            ctx,
          )
        }
        const values = await this.productOptionValueRepository.createMany(
          valueInputs.map((v, index) => ({ ...v, optionId, rank: v.rank ?? index })),
          ctx,
        )
        return { ...option, values }
      }

      const values = await this.productOptionValueRepository.find({ optionId }, { order: { rank: 'ASC' } }, ctx)
      return { ...option, values }
    })
  }

  async deleteProductOptions(optionIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      const activeLinks = await this.productProductOptionRepository.find({ optionId: optionIds }, undefined, ctx)
      if (activeLinks.length > 0) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message:
            'Cannot delete option(s) that are currently linked to products. Remove them from all products first.',
        })
      }

      const values = await this.productOptionValueRepository.find({ optionId: optionIds }, undefined, ctx)
      if (values.length > 0) {
        await this.productOptionValueRepository.softDelete(
          values.map((v) => v.id),
          ctx,
        )
      }
      await this.productOptionRepository.softDelete(optionIds, ctx)
    })
  }

  // ── Option Values ─────────────────────────────────────────────────────

  async createProductOptionValues(
    data: CreateProductOptionValueDTO[],
    context?: Context,
  ): Promise<ProductOptionValueDTO[]> {
    this.logger.debug(`Creating ${data.length} product option value(s)`)
    return this.withTransaction(context, async (ctx) => {
      return this.productOptionValueRepository.createMany(data, ctx)
    })
  }

  async createProductOptionValue(data: CreateProductOptionValueDTO, context?: Context): Promise<ProductOptionValueDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.productOptionValueRepository.create(data, ctx)
    })
  }

  async listProductOptionValues(
    filters?: FilterableProductOptionValueProps,
    config?: FindConfig<ProductOptionValueDTO>,
    context?: Context,
  ): Promise<ProductOptionValueDTO[]> {
    return this.productOptionValueRepository.find(filters, config, context)
  }

  async listAndCountProductOptionValues(
    filters?: FilterableProductOptionValueProps,
    config?: FindConfig<ProductOptionValueDTO>,
    context?: Context,
  ): Promise<[ProductOptionValueDTO[], number]> {
    return this.productOptionValueRepository.findAndCount(filters, config, context)
  }

  // ── Product-Option Linking ────────────────────────────────────────────

  async setProductOptions(productId: string, data: SetProductOptionsDTO, context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.checkProductOptionsStillCoverVariants(productId, data, ctx)

      const existingLinks = await this.productProductOptionRepository.find({ productId }, undefined, ctx)
      if (existingLinks.length > 0) {
        const linkIds = existingLinks.map((l) => l.id)
        const existingValueLinks = await this.productProductOptionValueRepository.find(
          { productProductOptionId: linkIds },
          undefined,
          ctx,
        )
        if (existingValueLinks.length > 0) {
          await this.productProductOptionValueRepository.softDelete(
            existingValueLinks.map((v) => v.id),
            ctx,
          )
        }
        await this.productProductOptionRepository.softDelete(linkIds, ctx)
      }

      for (const [rank, { optionId, valueIds }] of data.options.entries()) {
        const link = await this.productProductOptionRepository.create({ productId, optionId, rank }, ctx)
        if (valueIds.length > 0) {
          await this.productProductOptionValueRepository.createMany(
            valueIds.map((optionValueId) => ({ productProductOptionId: link.id, optionValueId })),
            ctx,
          )
        }
      }
    })
  }

  async listProductOptionsForProduct(productId: string, context?: Context): Promise<ProductOptionWithValuesDTO[]> {
    const productOptionLinks = await this.productProductOptionRepository.find(
      { productId },
      { order: { rank: 'ASC' } },
      context,
    )
    if (productOptionLinks.length === 0) return []

    const optionIds = productOptionLinks.map((l) => l.optionId)
    const options = await this.productOptionRepository.find({ id: optionIds }, undefined, context)

    const linkIds = productOptionLinks.map((l) => l.id)
    const valueLinks = await this.productProductOptionValueRepository.find(
      { productProductOptionId: linkIds },
      undefined,
      context,
    )

    const allowedValueIds = new Set(valueLinks.map((vl) => vl.optionValueId))

    const allValues = await this.productOptionValueRepository.find(
      { optionId: optionIds },
      { order: { rank: 'ASC' } },
      context,
    )

    const optionById = new Map(options.map((option) => [option.id, option]))

    return productOptionLinks.flatMap((link) => {
      const option = optionById.get(link.optionId)
      if (!option) return []

      const hasValueLinks = valueLinks.some((vl) => vl.productProductOptionId === link.id)
      const values = hasValueLinks
        ? allValues.filter((v) => v.optionId === option.id && allowedValueIds.has(v.id))
        : allValues.filter((v) => v.optionId === option.id)
      return { ...option, values }
    })
  }

  async listAndCountProductsForOption(
    optionId: string,
    filters?: FilterableProductProps,
    config?: FindConfig<ProductDTO>,
    context?: Context,
  ): Promise<[ProductDTO[], number]> {
    const links = await this.productProductOptionRepository.find({ optionId }, undefined, context)
    if (links.length === 0) return [[], 0]

    const productIds = links.map((l) => l.productId)
    return this.productRepository.findAndCount({ ...filters, id: productIds }, config, context)
  }

  // ── Images ────────────────────────────────────────────────────────────

  async listProductImages(
    filters?: FilterableProductImageProps,
    config?: FindConfig<ProductImageDTO>,
    context?: Context,
  ): Promise<ProductImageDTO[]> {
    return this.productImageRepository.find(filters, config, context)
  }

  async createProductImages(data: CreateProductImageDTO[], context?: Context): Promise<ProductImageDTO[]> {
    this.logger.debug(`Creating ${data.length} product image(s)`)
    return this.withTransaction(context, async (ctx) => {
      return this.productImageRepository.createMany(data, ctx)
    })
  }

  async createProductImage(data: CreateProductImageDTO, context?: Context): Promise<ProductImageDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.productImageRepository.create(data, ctx)
    })
  }

  // ── Variant images ────────────────────────────────────────────────────

  async listProductVariantImages(
    filters?: FilterableProductVariantImageProps,
    config?: FindConfig<ProductVariantImageDTO>,
    context?: Context,
  ): Promise<ProductVariantImageDTO[]> {
    return this.productVariantImageRepository.find(filters, config, context)
  }

  /** Resolves the product images assigned to a variant through the variant-image pivot. */
  async listImagesForVariant(variantId: string, context?: Context): Promise<ProductImageDTO[]> {
    const pivots = await this.productVariantImageRepository.find({ variantId }, undefined, context)
    if (pivots.length === 0) return []

    return this.productImageRepository.find(
      { id: pivots.map((pivot) => pivot.imageId) },
      { order: { rank: 'ASC' } },
      context,
    )
  }

  /** Resolves the variants an image is assigned to through the variant-image pivot. */
  async listVariantsForImage(imageId: string, context?: Context): Promise<ProductVariantDTO[]> {
    const pivots = await this.productVariantImageRepository.find({ imageId }, undefined, context)
    if (pivots.length === 0) return []

    return this.productVariantRepository.find(
      { id: pivots.map((pivot) => pivot.variantId) },
      { order: { variantRank: 'ASC' } },
      context,
    )
  }

  async addImageToVariant(data: VariantImageInput[], context?: Context): Promise<{ id: string }[]> {
    this.logger.debug(`Linking ${data.length} image(s) to variant(s)`)
    return this.withTransaction(context, async (ctx) => {
      const created = await this.productVariantImageRepository.createMany(data, ctx)
      return created.map(({ id }) => ({ id }))
    })
  }

  async removeImageFromVariant(data: VariantImageInput[], context?: Context): Promise<void> {
    if (data.length === 0) return
    return this.withTransaction(context, async (ctx) => {
      const linked = await this.productVariantImageRepository.find(
        { $or: data.map(({ imageId, variantId }) => ({ imageId, variantId })) },
        undefined,
        ctx,
      )
      await this.productVariantImageRepository.softDelete(
        linked.map((variantImage) => variantImage.id),
        ctx,
      )
    })
  }

  // ── Variant options ───────────────────────────────────────────────────

  async listProductVariantOptions(
    filters?: FilterableProductVariantOptionProps,
    config?: FindConfig<ProductVariantOptionDTO>,
    context?: Context,
  ): Promise<ProductVariantOptionDTO[]> {
    return this.productVariantOptionRepository.find(filters, config, context)
  }

  /** Resolves the option values a variant carries, in the option values' own rank order. */
  async listOptionValuesForVariant(variantId: string, context?: Context): Promise<ProductOptionValueDTO[]> {
    const links = await this.productVariantOptionRepository.find({ variantId }, undefined, context)
    if (links.length === 0) return []

    return this.productOptionValueRepository.find(
      { id: links.map((link) => link.optionValueId) },
      { order: { rank: 'ASC' } },
      context,
    )
  }

  /**
   * Each variant's Option Combination as an id map — the lean form the storefront ships and the
   * combination builder works with. Variants with no options map to `{}`.
   */
  async listVariantOptionMaps(
    variantIds: string[],
    context?: Context,
  ): Promise<Record<string, Record<string, string>>> {
    // An empty filter array would reach the query builder as `inArray(column, [])`.
    if (variantIds.length === 0) return {}

    const links = await this.productVariantOptionRepository.find({ variantId: variantIds }, undefined, context)

    const maps: Record<string, Record<string, string>> = Object.fromEntries(variantIds.map((id) => [id, {}]))
    for (const link of links) {
      const map = maps[link.variantId]
      if (map) map[link.optionId] = link.optionValueId
    }
    return maps
  }

  /**
   * The product's options with each value's variant usage attached — the shape every admin surface
   * that reads options through a product wants, so neither route has to assemble it.
   */
  async listProductScopedOptions(productId: string, context?: Context): Promise<ProductScopedOptionDTO[]> {
    const [options, counts] = await Promise.all([
      this.listProductOptionsForProduct(productId, context),
      this.countVariantsByOptionValue(productId, context),
    ])

    return options.map((option) => ({
      ...option,
      values: option.values.map((value) => ({ ...value, variantCount: counts[value.id] ?? 0 })),
    }))
  }

  /**
   * How many of the product's variants carry each option value, keyed by value id. Values with a
   * count cannot be unlinked from the product until those variants move, so the admin can say so
   * before a save is attempted rather than only after `setProductOptions` rejects it.
   */
  async countVariantsByOptionValue(productId: string, context?: Context): Promise<Record<string, number>> {
    const variants = await this.productVariantRepository.find({ productId }, undefined, context)
    if (variants.length === 0) return {}

    const links = await this.productVariantOptionRepository.find(
      { variantId: variants.map((variant) => variant.id) },
      undefined,
      context,
    )

    const counts: Record<string, number> = {}
    for (const link of links) counts[link.optionValueId] = (counts[link.optionValueId] ?? 0) + 1
    return counts
  }

  async enrichVariant(variant: ProductVariantDTO, context?: Context): Promise<EnrichedProductVariantDTO> {
    const [enriched] = await this.enrichVariants([variant], context)
    // A single input always yields a single output; the guard is for the compiler.
    return enriched ?? { ...variant, optionValues: [] }
  }

  async enrichVariants(variants: ProductVariantDTO[], context?: Context): Promise<EnrichedProductVariantDTO[]> {
    if (variants.length === 0) return []

    const maps = await this.listVariantOptionMaps(
      variants.map((variant) => variant.id),
      context,
    )

    // Labels and order belong to the product, not the variant, so options are read once per
    // product rather than once per variant.
    const productIds = [...new Set(variants.map((variant) => variant.productId))]
    const optionsByProductId = new Map(
      await Promise.all(
        productIds.map(
          async (productId) => [productId, await this.listProductOptionsForProduct(productId, context)] as const,
        ),
      ),
    )

    return variants.map((variant) => ({
      ...variant,
      optionValues: this.resolveOptionValues(optionsByProductId.get(variant.productId) ?? [], maps[variant.id] ?? {}),
    }))
  }

  /**
   * The Option Combinations this product could sell, each naming the variant that has it or `null`
   * while it is still available. One response drives the create form, the edit form and the matrix
   * step — each is a different filter over `variantId`.
   *
   * Paginated and searched here rather than in the client because the count is the product of the
   * option value counts, so it grows multiplicatively with the product's options.
   */
  async listProductOptionCombinations(
    productId: string,
    config?: { label?: string; limit?: number; offset?: number },
    context?: Context,
  ): Promise<[ProductOptionCombinationDTO[], number]> {
    const options = await this.listProductOptionsForProduct(productId, context)

    const total = countCombinations(options)
    if (total > MAX_OPTION_COMBINATIONS) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `This product's options produce ${total} combinations, above the limit of ${MAX_OPTION_COMBINATIONS}. Reduce the options or the values they offer.`,
      })
    }
    if (total === 0) return [[], 0]

    const combinations = await this.loadCombinations(productId, options, context)

    const query = config?.label?.trim().toLowerCase()
    const matched = query
      ? combinations.filter((combination) => combination.label.toLowerCase().includes(query))
      : combinations

    const offset = config?.offset ?? 0
    const limit = config?.limit ?? 50
    return [matched.slice(offset, offset + limit), matched.length]
  }

  /**
   * The storefront picker, precomputed: for every variant a shopper could be looking at, where
   * each option value would take them. Takes the variants the caller is actually shipping, since
   * the store route drops variants with no price and the picker must not offer those.
   */
  async buildProductPickerTargets(
    productId: string,
    variants: Array<{ id: string; optionValues: Record<string, string>; inStock: boolean }>,
    context?: Context,
  ): Promise<Record<string, Record<string, string | null>>> {
    const options = await this.listProductOptionsForProduct(productId, context)
    if (options.length === 0) return {}

    return buildPickerTargets({ options, variants })
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /**
   * The values a `setProductOptions` payload would leave the product offering, keyed by option.
   *
   * An option listing no values offers all of them — the same rule `listProductOptionsForProduct`
   * applies to the stored links, expressed here once for the incoming payload rather than at each
   * place that needs to know what a save would drop.
   */
  private async expandOfferedValues(data: SetProductOptionsDTO, context: Context): Promise<Map<string, Set<string>>> {
    const optionIds = data.options.map((option) => option.optionId)
    if (optionIds.length === 0) return new Map()

    const allValues = await this.productOptionValueRepository.find({ optionId: optionIds }, undefined, context)

    return new Map(
      data.options.map((option) => [
        option.optionId,
        new Set(
          option.valueIds.length > 0
            ? option.valueIds
            : allValues.filter((value) => value.optionId === option.optionId).map((value) => value.id),
        ),
      ]),
    )
  }

  /**
   * Refuses a `setProductOptions` payload that drops an option or a value some variant still
   * carries. Without this the product would keep variants whose combinations reference values the
   * product no longer offers, and the storefront picker could not render them.
   */
  private async checkProductOptionsStillCoverVariants(
    productId: string,
    data: SetProductOptionsDTO,
    context: Context,
  ): Promise<void> {
    const variants = await this.productVariantRepository.find({ productId }, undefined, context)
    if (variants.length === 0) return

    const links = await this.productVariantOptionRepository.find(
      { variantId: variants.map((variant) => variant.id) },
      undefined,
      context,
    )
    if (links.length === 0) return

    const offered = await this.expandOfferedValues(data, context)

    const droppedOptionIds = [...new Set(links.map((link) => link.optionId))].filter(
      (optionId) => !offered.has(optionId),
    )
    if (droppedOptionIds.length > 0) {
      const titles = await this.productOptionRepository.find({ id: droppedOptionIds }, undefined, context)
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Cannot remove option(s) that are currently used by variants: ${titles
          .map((option) => option.title)
          .join(', ')}. Update the affected variants first.`,
      })
    }

    const droppedValueIds = [
      ...new Set(
        links
          .filter((link) => offered.get(link.optionId)?.has(link.optionValueId) === false)
          .map((link) => link.optionValueId),
      ),
    ]
    if (droppedValueIds.length > 0) {
      const values = await this.productOptionValueRepository.find({ id: droppedValueIds }, undefined, context)
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Cannot remove option value(s) that are currently used by variants: ${values
          .map((value) => value.value)
          .join(', ')}. Update the affected variants first.`,
      })
    }
  }

  /**
   * Resolves each variant's `optionValues` map into the pivot rows to write, rejecting anything
   * the product cannot sell. Returns one entry per input variant: `undefined` where the caller
   * left `optionValues` out, which means "leave the existing combination alone".
   *
   * Every check is a lookup into the product's combinations, so what the admin is offered and what
   * the service accepts come from one function and cannot drift. Doing the whole batch at once is
   * what lets two new variants claiming the same combination reject each other, even though
   * neither is in the database yet.
   */
  private async resolveVariantCombinations(
    /** `id` is present on updates and absent on creates — it excludes a variant from colliding with itself. */
    variants: Array<{ id?: string; productId: string; title?: string; optionValues?: Record<string, string> }>,
    context: Context,
  ): Promise<Array<ResolvedCombination | undefined>> {
    // A scalar-only edit is the common case, and skipping it also skips the option reads below.
    if (variants.every((variant) => !variant.optionValues)) return variants.map(() => undefined)

    const productIds = [...new Set(variants.map((variant) => variant.productId))]
    const byProductId = new Map(
      await Promise.all(
        productIds.map(async (productId) => {
          const options = await this.listProductOptionsForProduct(productId, context)
          const combinations = await this.loadCombinations(productId, options, context)
          return [productId, { options, combinations }] as const
        }),
      ),
    )

    const claimedBy = new Map<string, string>()

    return variants.map(({ id, productId, title, optionValues }) => {
      if (!optionValues) return undefined

      const product = byProductId.get(productId)
      const options = product?.options ?? []
      const describe = title ?? id ?? 'the variant'

      // An explicit empty map clears the combination. Distinct from omitting the key, which leaves it.
      if (Object.keys(optionValues).length === 0) return { links: [], label: '' }

      const combination = findCombination(product?.combinations ?? [], optionValues)
      if (!combination) throw this.describeUnknownCombination(options, optionValues, describe)

      // Re-sending a variant's own combination is a no-op, not a collision.
      if (combination.variantId && combination.variantId !== id) {
        throw new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: `Variant (${combination.label}) with the provided options already exists.`,
        })
      }

      const clash = claimedBy.get(`${productId}:${combination.key}`)
      if (clash !== undefined) {
        throw new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: `Variant "${describe}" has the same combination of option values as "${clash}".`,
        })
      }
      claimedBy.set(`${productId}:${combination.key}`, describe)

      return {
        links: combination.values.map(({ optionId, valueId }) => ({ optionId, optionValueId: valueId })),
        label: combination.label,
      }
    })
  }

  /**
   * Why a payload matched no combination. The lookup itself yields a single bit, so this exists
   * only to turn that bit into a message naming what is actually wrong.
   */
  private describeUnknownCombination(
    options: ProductOptionWithValuesDTO[],
    optionValues: Record<string, string>,
    describe: string,
  ): AppError {
    const entries = Object.entries(optionValues)

    if (entries.length !== options.length) {
      return new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: `Product has ${options.length} option(s) but ${entries.length} option value(s) were provided for the variant: ${describe}.`,
      })
    }

    for (const [optionId, optionValueId] of entries) {
      const option = options.find((productOption) => productOption.id === optionId)
      if (!option) {
        return new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: `Option "${optionId}" is not available on this product.`,
        })
      }
      if (!option.values.some((value) => value.id === optionValueId)) {
        return new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: `Option value "${optionValueId}" does not exist for option ${option.title}.`,
        })
      }
    }

    return new AppError({
      type: ErrorTypes.INVALID_DATA,
      message: `The provided options are not a valid combination for the variant: ${describe}.`,
    })
  }

  /** The product's combinations, each knowing which variant carries it. */
  private async loadCombinations(
    productId: string,
    options: ProductOptionWithValuesDTO[],
    context?: Context,
  ): Promise<ProductOptionCombinationDTO[]> {
    const variants = await this.productVariantRepository.find({ productId }, undefined, context)
    const maps = await this.listVariantOptionMaps(
      variants.map((variant) => variant.id),
      context,
    )

    return buildCombinations({
      options,
      variants: variants.map((variant) => ({ id: variant.id, optionValues: maps[variant.id] ?? {} })),
    })
  }

  /** A variant's Option Combination resolved for display, in the product's option order. */
  private resolveOptionValues(
    options: ProductOptionWithValuesDTO[],
    optionValues: Record<string, string>,
  ): VariantOptionValueDTO[] {
    return options.flatMap((option) => {
      const valueId = optionValues[option.id]
      const value = option.values.find((optionValue) => optionValue.id === valueId)
      if (!valueId || !value) return []
      return { optionId: option.id, optionTitle: option.title, valueId, value: value.value }
    })
  }

  /**
   * A variant's title defaults to its combination's label, the way `resolveThumbnail` defaults a
   * product's thumbnail from its images. Titles are copied onto cart line items and order items,
   * so deriving them here keeps a shopper's order history consistent with the catalogue.
   */
  private resolveVariantTitle(
    title: string | undefined,
    resolved: ResolvedCombination | undefined,
  ): string | undefined {
    if (title !== undefined) return title
    return resolved?.label || undefined
  }

  /**
   * Full replace of a variant's pivot rows. Recreating after a soft delete is legal because every
   * unique index on the pivot is partial on `deleted_at IS NULL`.
   */
  private async replaceVariantOptionValues(
    variantId: string,
    links: Array<{ optionId: string; optionValueId: string }>,
    context: Context,
  ): Promise<void> {
    const existing = await this.productVariantOptionRepository.find({ variantId }, undefined, context)
    if (existing.length > 0) {
      await this.productVariantOptionRepository.softDelete(
        existing.map((link) => link.id),
        context,
      )
    }
    if (links.length === 0) return

    await this.productVariantOptionRepository.createMany(
      links.map(({ optionId, optionValueId }) => ({ variantId, optionId, optionValueId })),
      context,
    )
  }

  /**
   * A product's thumbnail defaults to its first image so the admin never has to pick one
   * explicitly. Only applies when the caller sends an `images` collection.
   */
  private resolveThumbnail(
    data: { thumbnail?: string | null },
    images: UpsertProductImageInput[] | undefined,
  ): string | null | undefined {
    if (!images) return data.thumbnail
    return data.thumbnail ?? images[0]?.url ?? null
  }

  /**
   * Collection replacement: entries carrying a known `id` are kept and re-ranked, entries without
   * one are created, and images the caller left out are soft-deleted. Rank follows array order.
   */
  private async replaceProductImages(
    productId: string,
    images: UpsertProductImageInput[],
    context?: Context,
  ): Promise<void> {
    const existing = await this.productImageRepository.find({ productId }, undefined, context)
    const existingIds = new Set(existing.map((image) => image.id))

    const keptIds = new Set<string>()
    const toCreate: CreateProductImageDTO[] = []
    const toUpdate: Array<{ id: string; url: string; rank: number }> = []

    images.forEach((image, rank) => {
      if (!image.id || !existingIds.has(image.id)) {
        toCreate.push({ productId, url: image.url, rank })
        return
      }
      keptIds.add(image.id)
      toUpdate.push({ id: image.id, url: image.url, rank })
    })

    const removedIds = existing.filter((image) => !keptIds.has(image.id)).map((image) => image.id)

    await this.productImageRepository.softDelete(removedIds, context)
    await Promise.all([
      this.productImageRepository.createMany(toCreate, context),
      ...toUpdate.map(({ id, url, rank }) => this.productImageRepository.update(id, { url, rank }, context)),
    ])
  }

  private async enrichOptionsWithValues(
    options: ProductOptionDTO[],
    context?: Context,
  ): Promise<ProductOptionWithValuesDTO[]> {
    if (options.length === 0) return []

    const optionIds = options.map((o) => o.id)
    const allValues = await this.productOptionValueRepository.find(
      { optionId: optionIds },
      { order: { rank: 'ASC' } },
      context,
    )

    const valuesByOptionId = new Map<string, ProductOptionValueDTO[]>()
    for (const value of allValues) {
      const existing = valuesByOptionId.get(value.optionId)
      if (existing) {
        existing.push(value)
      } else {
        valuesByOptionId.set(value.optionId, [value])
      }
    }

    return options.map((option) => ({
      ...option,
      values: valuesByOptionId.get(option.id) ?? [],
    }))
  }
}
