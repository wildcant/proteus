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
  FilterableProductOptionCombinationProps,
  FilterableProductOptionProps,
  FilterableProductOptionValueProps,
  FilterableProductProps,
  FilterableProductVariantImageProps,
  FilterableProductVariantOptionProps,
  FilterableProductVariantProps,
  FindConfig,
  IProductModuleService,
  PickerVariantDTO,
  ProductDTO,
  ProductImageDTO,
  ProductOptionCombinationDTO,
  ProductOptionCombinationPageDTO,
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
  UpsertProductOptionValueInput,
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
  type CombinableOption,
  combinationLabel,
  countCombinations,
  findCombination,
  MAX_OPTION_COMBINATIONS,
} from '../utils/option-combinations.js'
import {
  MAX_VARIANTS_PER_PRODUCT,
  planVariantReconciliation,
  type VariantReconciliationPlan,
} from '../utils/reconcile-variants.js'

/** A resolved Option Combination ready to write: the pivot rows, plus the label a title falls back to. */
type ResolvedCombination = {
  links: Array<{ optionId: string; optionValueId: string }>
  label: string
}

/** A product's options and everything they can combine into — the table a payload is checked against. */
type ProductCombinations = {
  options: ProductOptionWithValuesDTO[]
  combinations: ProductOptionCombinationDTO[]
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
      const resolved = await this.resolveCombinationsForCreate(
        data.map((variant) => ({ productId: variant.productId, optionValues: variant.optionValues })),
        ctx,
      )
      const fallbackTitles = await this.productTitlesFor(
        data.map((variant) => variant.productId),
        ctx,
      )

      const variants = await this.productVariantRepository.createMany(
        data.map(({ optionValues: _optionValues, ...variant }, index) => ({
          ...variant,
          title: resolved[index]?.label || fallbackTitles.get(variant.productId) || '',
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

      // Omitting `optionValues` leaves each variant's combination alone, which is why the resolver
      // is skipped rather than handed a map meaning "no change".
      const existing = await this.productVariantRepository.find({ id: variantIds }, undefined, ctx)
      const resolved = optionValues ? await this.resolveCombinationsForUpdate(existing, optionValues, ctx) : []

      // The title is derived, so it follows the combination — a variant moved from M/White to
      // L/White must not keep advertising the old name onto new line items.
      const combination = resolved[0]
      const fallbackTitle = existing[0] ? await this.productTitleFor(existing[0].productId, ctx) : ''
      const changes = { ...columns, ...(combination ? { title: combination.label || fallbackTitle } : {}) }

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
      await this.productVariantRepository.softDelete(variantIds, ctx)
    })
  }

  async resolveVariantThumbnail(variantId: string, context?: Context): Promise<string | null> {
    // Finding rather than retrieving: an unknown variant yields no thumbnail instead of throwing.
    const [variant] = await this.productVariantRepository.find({ id: variantId }, undefined, context)
    if (!variant) return null
    if (variant.thumbnail) return variant.thumbnail

    const [product] = await this.productRepository.find({ id: variant.productId }, undefined, context)
    return product?.thumbnail ?? null
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
        const values = await this.replaceOptionValues(optionId, valueInputs, ctx)
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

  /**
   * Replaces which options a product offers and which of their values. Says nothing about the
   * product's variants — `planProductOptionChange` answers what the change does to those, and
   * `setProductOptionsWorkflow` applies both together.
   */
  async setProductOptions(productId: string, data: SetProductOptionsDTO, context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      const existingLinks = await this.productProductOptionRepository.find({ productId }, undefined, ctx)
      if (existingLinks.length > 0) {
        await this.productProductOptionRepository.softDelete(
          existingLinks.map((link) => link.id),
          ctx,
        )
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

  /**
   * What a proposed set of options would do to the product's variants.
   *
   * Reads only — the caller decides whether to apply it. Both halves of the question come from the
   * same place a variant write is validated against, so what the product would offer and what it
   * would accept cannot drift.
   */
  async planProductOptionChange(
    productId: string,
    data: SetProductOptionsDTO,
    context?: Context,
  ): Promise<VariantReconciliationPlan> {
    const [currentOptions, nextOptions] = await Promise.all([
      this.listProductOptionsForProduct(productId, context),
      this.resolveNextOptions(data, context),
    ])

    const variants = await this.productVariantRepository.find({ productId }, undefined, context)
    const maps = await this.listVariantOptionMaps(
      variants.map((variant) => variant.id),
      context,
    )

    const plan = planVariantReconciliation({
      currentOptions,
      nextOptions,
      variants: variants.map((variant) => ({
        id: variant.id,
        title: variant.title,
        optionValues: maps[variant.id] ?? {},
        createdAt: variant.createdAt,
      })),
    })

    const total = plan.keep.length + plan.reassign.length + plan.create.length
    if (total > MAX_VARIANTS_PER_PRODUCT) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `These options would leave the product with ${total} variants, above the limit of ${MAX_VARIANTS_PER_PRODUCT}. Reduce the options or the values they offer.`,
      })
    }

    return plan
  }

  /**
   * Moves variants onto the combinations a plan assigned them, retitling as it goes.
   *
   * Separate from `updateProductVariants` because a reconciliation reassigns several variants at
   * once and each lands somewhere different, which that method's single-combination contract
   * deliberately refuses.
   */
  async applyVariantReassignments(
    reassignments: ReadonlyArray<{ variantId: string; optionValues: Record<string, string> }>,
    context?: Context,
  ): Promise<void> {
    if (reassignments.length === 0) return

    return this.withTransaction(context, async (ctx) => {
      await Promise.all(
        reassignments.map(({ variantId, optionValues }) =>
          this.replaceVariantOptionValues(
            variantId,
            Object.entries(optionValues).map(([optionId, optionValueId]) => ({ optionId, optionValueId })),
            ctx,
          ),
        ),
      )

      const variants = await this.productVariantRepository.find(
        { id: reassignments.map((entry) => entry.variantId) },
        undefined,
        ctx,
      )
      await this.retitleVariants(variants, ctx)
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

  /**
   * Brings every variant carrying one of these option values back in line with its combination.
   *
   * Titles are derived, so a value rename that left them alone would make "derived" a lie — and a
   * stale title is copied onto the next line item and kept in order history for good. The retitling
   * itself goes through `retitleVariants`, so there is one way to name a combination.
   */
  async retitleVariantsCarrying(optionValueIds: string[], context?: Context): Promise<void> {
    if (optionValueIds.length === 0) return

    const links = await this.productVariantOptionRepository.find({ optionValueId: optionValueIds }, undefined, context)
    if (links.length === 0) return

    const variants = await this.productVariantRepository.find(
      { id: [...new Set(links.map((link) => link.variantId))] },
      undefined,
      context,
    )
    if (variants.length === 0) return

    await this.retitleVariants(variants, context)
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
   * while it is still available. One response drives the create form and the edit form — each
   * passes a different `scope`.
   *
   * Paginated and searched here rather than in the client because the count is the product of the
   * option value counts, so it grows multiplicatively with the product's options.
   *
   * The two totals are deliberately measured before `label` narrows anything: a client asking
   * "does this product have options at all" or "is every combination taken" is asking about the
   * product, not about what the shopkeeper happens to have typed. Deriving those from `count`
   * makes a search that matches nothing look like a product with no options.
   */
  async listProductOptionCombinations(
    filters: FilterableProductOptionCombinationProps,
    config?: FindConfig<ProductOptionCombinationDTO>,
    context?: Context,
  ): Promise<ProductOptionCombinationPageDTO> {
    const options = await this.listProductOptionsForProduct(filters.productId, context)

    const totalCombinations = countCombinations(options)
    if (totalCombinations > MAX_OPTION_COMBINATIONS) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `This product's options produce ${totalCombinations} combinations, above the limit of ${MAX_OPTION_COMBINATIONS}. Reduce the options or the values they offer.`,
      })
    }
    if (totalCombinations === 0) {
      return { combinations: [], count: 0, totalCombinations: 0, availableCombinations: 0 }
    }

    const combinations = await this.loadCombinations(filters.productId, options, context)

    // A variant editing its own combination must still find it in an `available` list — it is
    // taken by the very variant asking.
    const isFree = (combination: ProductOptionCombinationDTO) =>
      combination.variantId === null || combination.variantId === filters.variantId
    const scoped = filters.scope === 'available' ? combinations.filter(isFree) : combinations

    const query = filters.label?.trim().toLowerCase()
    const matched = query ? scoped.filter((combination) => combination.label.toLowerCase().includes(query)) : scoped

    const offset = config?.offset ?? 0
    const limit = config?.limit ?? 50
    return {
      combinations: matched.slice(offset, offset + limit),
      count: matched.length,
      totalCombinations,
      availableCombinations: combinations.filter(isFree).length,
    }
  }

  /**
   * The storefront picker, precomputed: for every variant a shopper could be looking at, where
   * each option value would take them. Takes the variants the caller is actually shipping, since
   * the store route drops variants with no price and the picker must not offer those.
   */
  async buildProductPickerTargets(
    productId: string,
    variants: readonly PickerVariantDTO[],
    context?: Context,
  ): Promise<Record<string, Record<string, string | null>>> {
    const options = await this.listProductOptionsForProduct(productId, context)
    if (options.length === 0) return {}

    return buildPickerTargets({ options, variants })
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /**
   * Brings a set of variants' titles back in line with the combinations they carry.
   *
   * The one place a derived title is written, so a reassignment and a value rename can never
   * disagree about what a variant is called. A variant with no combination falls back to its
   * product's title; one whose title is already right is left alone rather than rewritten.
   */
  private async retitleVariants(variants: ProductVariantDTO[], context?: Context): Promise<void> {
    if (variants.length === 0) return

    const enriched = await this.enrichVariants(variants, context)
    const fallbackTitles = await this.productTitlesFor(
      variants.map((variant) => variant.productId),
      context,
    )

    await Promise.all(
      enriched.map((variant) => {
        const title = combinationLabel(variant.optionValues) || fallbackTitles.get(variant.productId) || ''
        if (!title || title === variant.title) return undefined
        return this.productVariantRepository.update(variant.id, { title }, context)
      }),
    )
  }

  /**
   * The Product-Scoped Options a `setProductOptions` payload would leave behind, in payload order.
   *
   * An option listing no values offers all of them — the same rule `listProductOptionsForProduct`
   * applies to the stored links, expressed once here for a payload that has not been saved yet.
   */
  private async resolveNextOptions(data: SetProductOptionsDTO, context?: Context): Promise<CombinableOption[]> {
    const optionIds = data.options.map((option) => option.optionId)
    if (optionIds.length === 0) return []

    const [options, allValues] = await Promise.all([
      this.productOptionRepository.find({ id: optionIds }, undefined, context),
      this.productOptionValueRepository.find({ optionId: optionIds }, { order: { rank: 'ASC' } }, context),
    ])
    const optionById = new Map(options.map((option) => [option.id, option]))

    return data.options.flatMap((entry) => {
      const option = optionById.get(entry.optionId)
      if (!option) return []
      const offered = allValues.filter((value) => value.optionId === entry.optionId)
      const values = entry.valueIds.length > 0 ? offered.filter((value) => entry.valueIds.includes(value.id)) : offered
      return { id: option.id, title: option.title, values }
    })
  }

  /**
   * The pivot rows each new variant's combination becomes, one entry per input variant.
   *
   * A create names its combination in full — it has no existing one to leave alone — so an
   * incomplete map is an error and `{}` resolves to nothing only for a product that offers no
   * options at all. Taking the whole batch at once is what lets two new variants claiming the same
   * combination reject each other, even though neither is in the database yet.
   *
   * Every check is a lookup into the product's combinations, which is what keeps what the admin is
   * offered and what the service accepts from drifting apart.
   */
  private async resolveCombinationsForCreate(
    variants: Array<{ productId: string; title?: string; optionValues: Record<string, string> }>,
    context: Context,
  ): Promise<ResolvedCombination[]> {
    const byProductId = await this.loadCombinationsByProductId(
      variants.map((variant) => variant.productId),
      context,
    )
    const claimedBy = new Map<string, string>()

    return variants.map(({ productId, title, optionValues }) => {
      const product = byProductId.get(productId)
      const describe = title ?? 'the variant'

      // An empty combination is complete for exactly one kind of product: one with no options.
      if (Object.keys(optionValues).length === 0) {
        const options = product?.options ?? []
        if (options.length > 0) throw this.describeUnknownCombination(options, optionValues, describe)
        return { links: [], label: '' }
      }

      const combination = this.matchCombination(product, optionValues, describe)

      if (combination.variantId) {
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

      return this.toResolvedCombination(combination)
    })
  }

  /**
   * The pivot rows the targeted variants move onto, one entry per variant.
   *
   * Only reached when the caller sent a map, since omitting it means "leave the combination alone".
   * An empty one clears the combination instead — the one way a variant ends up carrying none, and
   * how a variant stranded by an option added after the fact gets fixed.
   */
  private async resolveCombinationsForUpdate(
    variants: Array<{ id: string; productId: string; title?: string }>,
    optionValues: Record<string, string>,
    context: Context,
  ): Promise<ResolvedCombination[]> {
    if (Object.keys(optionValues).length === 0) return variants.map(() => ({ links: [], label: '' }))

    // Every target is handed the same map, and a combination belongs to one variant, so more than
    // one target is a collision by definition rather than something to resolve.
    if (variants.length > 1) {
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: 'A combination belongs to a single variant, so it cannot be assigned to several at once.',
      })
    }

    const byProductId = await this.loadCombinationsByProductId(
      variants.map((variant) => variant.productId),
      context,
    )

    return variants.map((variant) => {
      const combination = this.matchCombination(
        byProductId.get(variant.productId),
        optionValues,
        variant.title ?? variant.id,
      )

      // Re-sending a variant its own combination is a no-op, not a collision.
      if (combination.variantId && combination.variantId !== variant.id) {
        throw new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: `Variant (${combination.label}) with the provided options already exists.`,
        })
      }

      return this.toResolvedCombination(combination)
    })
  }

  /** Each product's options and the combinations they generate, keyed by product id. */
  private async loadCombinationsByProductId(
    productIds: string[],
    context: Context,
  ): Promise<Map<string, ProductCombinations>> {
    return new Map(
      await Promise.all(
        [...new Set(productIds)].map(async (productId) => {
          const options = await this.listProductOptionsForProduct(productId, context)
          const combinations = await this.loadCombinations(productId, options, context)
          return [productId, { options, combinations }] as const
        }),
      ),
    )
  }

  /** The combination a payload names, or an error saying why the product cannot sell it. */
  private matchCombination(
    product: ProductCombinations | undefined,
    optionValues: Record<string, string>,
    describe: string,
  ): ProductOptionCombinationDTO {
    const combination = findCombination(product?.combinations ?? [], optionValues)
    if (!combination) throw this.describeUnknownCombination(product?.options ?? [], optionValues, describe)
    return combination
  }

  /** A combination as the variant-option rows that record it. */
  private toResolvedCombination(combination: ProductOptionCombinationDTO): ResolvedCombination {
    return {
      links: combination.values.map(({ optionId, valueId }) => ({ optionId, optionValueId: valueId })),
      label: combination.label,
    }
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
   * What a variant of an option-less product is called. Its combination's label is empty and the
   * column is NOT NULL, so the product's own name is the only thing left that identifies it on a
   * line item.
   */
  private async productTitlesFor(productIds: string[], context?: Context): Promise<Map<string, string>> {
    const unique = [...new Set(productIds)]
    if (unique.length === 0) return new Map()
    const products = await this.productRepository.find({ id: unique }, undefined, context)
    return new Map(products.map((product) => [product.id, product.title]))
  }

  private async productTitleFor(productId: string, context?: Context): Promise<string> {
    return (await this.productTitlesFor([productId], context)).get(productId) ?? ''
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
   * Collection replacement for an option's values, shaped like `replaceProductImages`: entries
   * carrying a known `id` are updated in place, entries without one are created, and values the
   * caller left out are soft-deleted. Rank follows array order.
   *
   * Updating in place is what makes a *rename* expressible at all. Matching on the value string
   * instead — as this did — turned "Blk" becoming "Black" into a delete plus an insert, which
   * broke every variant link and was refused outright the moment a product used the value.
   */
  private async replaceOptionValues(
    optionId: string,
    valueInputs: UpsertProductOptionValueInput[],
    context: Context,
  ): Promise<ProductOptionValueDTO[]> {
    const existing = await this.productOptionValueRepository.find({ optionId }, undefined, context)
    const existingIds = new Set(existing.map((value) => value.id))

    const keptIds = new Set<string>()
    valueInputs.forEach((value) => {
      if (value.id && existingIds.has(value.id)) keptIds.add(value.id)
    })

    const removedIds = existing.filter((value) => !keptIds.has(value.id)).map((value) => value.id)
    if (removedIds.length > 0) {
      // Values are global, so unlinking them from every product stays a deliberate act. This is a
      // different question from a product dropping a value it offers, which reconciliation handles.
      const activeValueLinks = await this.productProductOptionValueRepository.find(
        { optionValueId: removedIds },
        undefined,
        context,
      )
      if (activeValueLinks.length > 0) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message:
            'Cannot remove option value(s) that are currently used by products. Remove them from all products first.',
        })
      }
      await this.productOptionValueRepository.softDelete(removedIds, context)
    }

    const renamedIds: string[] = []
    await Promise.all(
      valueInputs.map((input, rank) => {
        const { id, ...columns } = input
        if (!id || !existingIds.has(id)) {
          return this.productOptionValueRepository.create({ ...columns, optionId, rank: columns.rank ?? rank }, context)
        }
        if (existing.some((value) => value.id === id && value.value !== columns.value)) renamedIds.push(id)
        return this.productOptionValueRepository.update(id, { ...columns, rank: columns.rank ?? rank }, context)
      }),
    )

    await this.retitleVariantsCarrying(renamedIds, context)

    return this.productOptionValueRepository.find({ optionId }, { order: { rank: 'ASC' } }, context)
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
