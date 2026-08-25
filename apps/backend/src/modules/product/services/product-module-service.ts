import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type {
  AppliedProductOptionChangeDTO,
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
  UpsertProductVariantDTO,
  VariantImageInput,
  VariantReassignmentDTO,
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
import { combinationLabel } from '../utils/option-combinations.js'
import type { VariantReconciliationPlan, VariantRemovalReason } from '../utils/reconcile-variants.js'
import { ProductOptionService } from './product-option-service.js'

/**
 * Everything the module is built from. The five option repositories are not used here — they are
 * what `ProductOptionService` is built from, and this is the only place that builds it.
 */
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

/**
 * The product module's one service, and the only thing outside the module can hold.
 *
 * Options are a subject large enough to be their own file — three layers of table and ten rules,
 * all in `docs/product-options.md` — so they live in `ProductOptionService`, which this composes
 * and nothing else can reach. The module's public surface is this class implementing
 * `IProductModuleService`, exactly as it was before the split.
 */
export class ProductModuleService implements IProductModuleService {
  private productRepository: ProductRepository
  private productVariantRepository: ProductVariantRepository
  private productImageRepository: ProductImageRepository
  private productVariantImageRepository: ProductVariantImageRepository
  /** Private on purpose: not registered anywhere, not exported, not resolvable. */
  private productOptionService: ProductOptionService
  private withTransaction: WithTransaction
  private logger: Logger

  constructor(dependencies: InjectedDependencies) {
    this.productRepository = dependencies.productRepository
    this.productVariantRepository = dependencies.productVariantRepository
    this.productImageRepository = dependencies.productImageRepository
    this.productVariantImageRepository = dependencies.productVariantImageRepository
    this.withTransaction = dependencies.withTransaction
    this.logger = dependencies.logger
    // Built from the same cradle this was, so it shares the module's repositories and transaction
    // helper rather than opening its own.
    this.productOptionService = new ProductOptionService(dependencies)
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

  async softDeleteProducts(productIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.productRepository.softDelete(productIds, ctx)
    })
  }

  // ── Variants ──────────────────────────────────────────────────────────

  async createProductVariants(data: CreateProductVariantDTO[], context?: Context): Promise<ProductVariantDTO[]> {
    this.logger.debug(`Creating ${data.length} product variant(s)`)
    return this.withTransaction(context, async (ctx) => {
      const resolved = await this.productOptionService.resolveCombinationsForCreate(
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
          return combination
            ? this.productOptionService.replaceVariantOptionValues(variant, combination.links, ctx)
            : undefined
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
      const resolved = optionValues
        ? await this.productOptionService.resolveCombinationsForUpdate(existing, optionValues, ctx)
        : []

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
          return combination
            ? this.productOptionService.replaceVariantOptionValues(variant, combination.links, ctx)
            : undefined
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

  async softDeleteProductVariants(variantIds: string[], context?: Context): Promise<void> {
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

  // ── Product-Option Linking ────────────────────────────────────────────

  /**
   * Replaces which options a product offers and which of their values, and brings its variants
   * along as far as it can without removing any.
   *
   * Refused when the change does not fit the variants the product has — a variant would be left
   * carrying a value the product no longer offers, or two variants would end up standing for the
   * same combination. Resolving that means deleting variants, which reaches price sets, links and
   * carts, so it belongs to `applyProductOptionChange` and the workflow around it. What stays here
   * is the guarantee that no other caller can leave the product in either state.
   */
  async setProductOptions(productId: string, data: SetProductOptionsDTO, context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      const plan = await this.moveOptionsAndVariants(productId, data, ctx)
      // After the write, not before: the refusal rolls the transaction back, and computing the plan
      // twice to decide first would let the two answers disagree.
      if (plan.remove.length > 0) throw this.describeRefusedOptionChange(plan)
    })
  }

  /**
   * The same change, applied together with the variant moves it forces, as one transaction.
   *
   * Adding an option leaves every existing variant needing a value for it, and dropping one leaves
   * variants standing for combinations that no longer exist. Neither intermediate state is legal,
   * and no ordering of separate calls avoids it — so the option write and the variant moves happen
   * together or not at all.
   *
   * The variants it cannot keep are reported rather than removed. Removing one reaches price sets,
   * links and carts, which this module cannot touch, and it has to be the last thing that happens
   * so that nothing has to be put back.
   */
  async applyProductOptionChange(
    productId: string,
    data: SetProductOptionsDTO,
    context?: Context,
  ): Promise<AppliedProductOptionChangeDTO> {
    return this.withTransaction(context, async (ctx) => {
      const plan = await this.moveOptionsAndVariants(productId, data, ctx)

      const created =
        plan.create.length > 0
          ? await this.createProductVariants(
              plan.create.map((entry) => ({ productId, optionValues: entry.combination.optionValues })),
              ctx,
            )
          : []

      return { plan, created }
    })
  }

  /**
   * Puts a product's options and its variants' combinations back as they were.
   *
   * Only a compensating step has any business calling this. It writes the options without asking
   * whether the variants cover them, then writes each variant's recorded combination back — the
   * one case where what the variants should be is *known* rather than derived, and so the one case
   * where skipping the guard is not skipping a check.
   */
  async revertProductOptionChange(
    productId: string,
    options: SetProductOptionsDTO,
    combinations: readonly VariantReassignmentDTO[],
    context?: Context,
  ): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.productOptionService.writeProductOptions(productId, options, ctx)
      await this.applyVariantReassignments(combinations, ctx)
    })
  }

  /**
   * Moves variants onto the combinations a plan assigned them, retitling as it goes.
   *
   * Separate from `updateProductVariants` because a reconciliation reassigns several variants at
   * once and each lands somewhere different, which that method's single-combination contract
   * deliberately refuses.
   */
  async applyVariantReassignments(reassignments: readonly VariantReassignmentDTO[], context?: Context): Promise<void> {
    if (reassignments.length === 0) return

    return this.withTransaction(context, async (ctx) => {
      // Read before writing: the pivot points at the product's option rows, so it needs to know
      // which product each variant belongs to before it can resolve them.
      const variants = await this.productVariantRepository.find(
        { id: reassignments.map((entry) => entry.variantId) },
        undefined,
        ctx,
      )
      const variantById = new Map(variants.map((variant) => [variant.id, variant]))

      await Promise.all(
        reassignments.map(({ variantId, optionValues }) => {
          const variant = variantById.get(variantId)
          // Skipped rather than failed: a compensating step replays combinations captured before
          // the change, and a variant removed since is one it should leave alone.
          if (!variant) return undefined
          return this.productOptionService.replaceVariantOptionValues(
            variant,
            Object.entries(optionValues).map(([optionId, optionValueId]) => ({ optionId, optionValueId })),
            ctx,
          )
        }),
      )

      await this.retitleVariants(variants, ctx)
    })
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

  /**
   * Brings every variant carrying one of these option values back in line with its combination.
   *
   * Titles are derived, so a value rename that left them alone would make "derived" a lie — and a
   * stale title is copied onto the next line item and kept in order history for good. The retitling
   * itself goes through `retitleVariants`, so there is one way to name a combination.
   */
  async retitleVariantsCarrying(optionValueIds: string[], context?: Context): Promise<void> {
    if (optionValueIds.length === 0) return

    const variantIds = await this.productOptionService.listVariantIdsCarrying(optionValueIds, context)
    if (variantIds.length === 0) return

    const variants = await this.productVariantRepository.find({ id: variantIds }, undefined, context)
    if (variants.length === 0) return

    await this.retitleVariants(variants, context)
  }

  // ── Options ───────────────────────────────────────────────────────────
  //
  // A module exposes exactly one service, so these stay on the port and forward to
  // `ProductOptionService`. Only the two that also touch a variant do any work of their own.

  async createProductOption(data: CreateProductOptionDTO, context?: Context): Promise<ProductOptionWithValuesDTO> {
    return this.productOptionService.createProductOption(data, context)
  }

  async createProductOptions(data: CreateProductOptionDTO[], context?: Context): Promise<ProductOptionDTO[]> {
    return this.productOptionService.createProductOptions(data, context)
  }

  async listProductOptions(
    filters?: FilterableProductOptionProps,
    config?: FindConfig<ProductOptionDTO>,
    context?: Context,
  ): Promise<ProductOptionWithValuesDTO[]> {
    return this.productOptionService.listProductOptions(filters, config, context)
  }

  async listAndCountProductOptions(
    filters?: FilterableProductOptionProps,
    config?: FindConfig<ProductOptionDTO>,
    context?: Context,
  ): Promise<[ProductOptionWithValuesDTO[], number]> {
    return this.productOptionService.listAndCountProductOptions(filters, config, context)
  }

  async retrieveProductOption(optionId: string, context?: Context): Promise<ProductOptionWithValuesDTO> {
    return this.productOptionService.retrieveProductOption(optionId, context)
  }

  /**
   * Renaming a value renames every variant standing for it, which is the one part of an option
   * edit that writes to a variant — so it happens here rather than in the option service.
   */
  async updateProductOption(
    optionId: string,
    data: UpdateProductOptionDTO,
    context?: Context,
  ): Promise<ProductOptionWithValuesDTO> {
    return this.withTransaction(context, async (ctx) => {
      const { option, renamedValueIds } = await this.productOptionService.updateProductOption(optionId, data, ctx)
      await this.retitleVariantsCarrying(renamedValueIds, ctx)
      return option
    })
  }

  async softDeleteProductOptions(optionIds: string[], context?: Context): Promise<void> {
    return this.productOptionService.softDeleteProductOptions(optionIds, context)
  }

  // ── Option values ─────────────────────────────────────────────────────

  async createProductOptionValues(
    data: CreateProductOptionValueDTO[],
    context?: Context,
  ): Promise<ProductOptionValueDTO[]> {
    return this.productOptionService.createProductOptionValues(data, context)
  }

  async createProductOptionValue(data: CreateProductOptionValueDTO, context?: Context): Promise<ProductOptionValueDTO> {
    return this.productOptionService.createProductOptionValue(data, context)
  }

  async listProductOptionValues(
    filters?: FilterableProductOptionValueProps,
    config?: FindConfig<ProductOptionValueDTO>,
    context?: Context,
  ): Promise<ProductOptionValueDTO[]> {
    return this.productOptionService.listProductOptionValues(filters, config, context)
  }

  async listAndCountProductOptionValues(
    filters?: FilterableProductOptionValueProps,
    config?: FindConfig<ProductOptionValueDTO>,
    context?: Context,
  ): Promise<[ProductOptionValueDTO[], number]> {
    return this.productOptionService.listAndCountProductOptionValues(filters, config, context)
  }

  // ── A product's options ───────────────────────────────────────────────

  async listProductOptionsForProduct(productId: string, context?: Context): Promise<ProductOptionWithValuesDTO[]> {
    return this.productOptionService.listProductOptionsForProduct(productId, context)
  }

  async listProductScopedOptions(productId: string, context?: Context): Promise<ProductScopedOptionDTO[]> {
    return this.productOptionService.listProductScopedOptions(productId, context)
  }

  async countVariantsByOptionValue(productId: string, context?: Context): Promise<Record<string, number>> {
    return this.productOptionService.countVariantsByOptionValue(productId, context)
  }

  async listAndCountProductsForOption(
    optionId: string,
    filters?: FilterableProductProps,
    config?: FindConfig<ProductDTO>,
    context?: Context,
  ): Promise<[ProductDTO[], number]> {
    return this.productOptionService.listAndCountProductsForOption(optionId, filters, config, context)
  }

  // ── Variant options ───────────────────────────────────────────────────

  async listProductVariantOptions(
    filters?: FilterableProductVariantOptionProps,
    config?: FindConfig<ProductVariantOptionDTO>,
    context?: Context,
  ): Promise<ProductVariantOptionDTO[]> {
    return this.productOptionService.listProductVariantOptions(filters, config, context)
  }

  async listOptionValuesForVariant(variantId: string, context?: Context): Promise<ProductOptionValueDTO[]> {
    return this.productOptionService.listOptionValuesForVariant(variantId, context)
  }

  async listVariantOptionMaps(
    variantIds: string[],
    context?: Context,
  ): Promise<Record<string, Record<string, string>>> {
    return this.productOptionService.listVariantOptionMaps(variantIds, context)
  }

  async enrichVariant(variant: ProductVariantDTO, context?: Context): Promise<EnrichedProductVariantDTO> {
    return this.productOptionService.enrichVariant(variant, context)
  }

  async enrichVariants(variants: ProductVariantDTO[], context?: Context): Promise<EnrichedProductVariantDTO[]> {
    return this.productOptionService.enrichVariants(variants, context)
  }

  // ── Combinations ──────────────────────────────────────────────────────

  async planProductOptionChange(
    productId: string,
    data: SetProductOptionsDTO,
    context?: Context,
  ): Promise<VariantReconciliationPlan> {
    return this.productOptionService.planProductOptionChange(productId, data, context)
  }

  async listProductOptionCombinations(
    filters: FilterableProductOptionCombinationProps,
    config?: FindConfig<ProductOptionCombinationDTO>,
    context?: Context,
  ): Promise<ProductOptionCombinationPageDTO> {
    return this.productOptionService.listProductOptionCombinations(filters, config, context)
  }

  async buildProductPickerTargets(
    productId: string,
    variants: readonly PickerVariantDTO[],
    context?: Context,
  ): Promise<Record<string, Record<string, string | null>>> {
    return this.productOptionService.buildProductPickerTargets(productId, variants, context)
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

    const enriched = await this.productOptionService.enrichVariants(variants, context)
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
   * Writes the options and moves the variants onto them — everything the two public entry points
   * do identically. What they add is their own: one refuses the plan it gets back, the other fills
   * in the combinations nothing covers yet.
   *
   * Returns the plan so the caller can act on it without computing it a second time against state
   * this has already changed.
   */
  private async moveOptionsAndVariants(
    productId: string,
    data: SetProductOptionsDTO,
    context: Context,
  ): Promise<VariantReconciliationPlan> {
    const plan = await this.planProductOptionChange(productId, data, context)

    await this.productOptionService.writeProductOptions(productId, data, context)
    await this.applyVariantReassignments(this.reassignmentsOf(plan), context)

    return plan
  }

  /** A plan's reassignments in the shape `applyVariantReassignments` takes. */
  private reassignmentsOf(plan: VariantReconciliationPlan): VariantReassignmentDTO[] {
    return plan.reassign.map((entry) => ({ variantId: entry.variantId, optionValues: entry.combination.optionValues }))
  }

  /**
   * Why an option change does not fit the variants the product has.
   *
   * Both reasons are a variant the change leaves nowhere to be — one because the value it stands
   * for is going, one because the combination it would land on is already taken. Neither is
   * something the payload can be corrected into: the caller has to deal with the variants, or use
   * the path that deals with them for it.
   */
  private describeRefusedOptionChange(plan: VariantReconciliationPlan): AppError {
    const titlesFor = (reason: VariantRemovalReason) =>
      plan.remove.filter((entry) => entry.reason === reason).map((entry) => entry.title)

    const dropped = titlesFor('value-dropped')
    const collapsed = titlesFor('collapsed')

    const reasons = [
      dropped.length > 0 ? `${dropped.join(', ')} carr${dropped.length > 1 ? 'y' : 'ies'} a value it removes` : null,
      collapsed.length > 0 ? `${collapsed.join(', ')} would stand for a combination another variant already has` : null,
    ].filter((reason) => reason !== null)

    return new AppError({
      type: ErrorTypes.NOT_ALLOWED,
      message: `These options do not fit the product's variants: ${reasons.join('; ')}. Remove those variants first, or make the change from the admin, which moves them for you.`,
    })
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
}
