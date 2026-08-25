import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type {
  Context,
  CreateProductOptionDTO,
  CreateProductOptionValueDTO,
  EnrichedProductVariantDTO,
  FilterableProductOptionCombinationProps,
  FilterableProductOptionProps,
  FilterableProductOptionValueProps,
  FilterableProductProps,
  FilterableProductVariantOptionProps,
  FindConfig,
  PickerVariantDTO,
  ProductDTO,
  ProductOptionCombinationDTO,
  ProductOptionCombinationPageDTO,
  ProductOptionDTO,
  ProductOptionValueDTO,
  ProductOptionWithValuesDTO,
  ProductProductOptionDTO,
  ProductScopedOptionDTO,
  ProductVariantDTO,
  ProductVariantOptionDTO,
  SetProductOptionsDTO,
  UpdateProductOptionDTO,
  UpsertProductOptionValueInput,
  VariantOptionValueDTO,
} from '../../../core/types/index.js'
import type { Logger } from '../../../core/types/logger.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { ProductRepository } from '../repositories/product.js'
import type { ProductOptionRepository } from '../repositories/product-option.js'
import type { ProductOptionValueRepository } from '../repositories/product-option-value.js'
import type { ProductProductOptionRepository } from '../repositories/product-product-option.js'
import type { ProductProductOptionValueRepository } from '../repositories/product-product-option-value.js'
import type { ProductVariantRepository } from '../repositories/product-variant.js'
import type { ProductVariantOptionRepository } from '../repositories/product-variant-option.js'
import {
  buildCombinations,
  buildPickerTargets,
  type CombinableOption,
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
export type ResolvedCombination = {
  links: Array<{ optionId: string; optionValueId: string }>
  label: string
}

/** A product's options and everything they can combine into — the table a payload is checked against. */
type ProductCombinations = {
  options: ProductOptionWithValuesDTO[]
  combinations: ProductOptionCombinationDTO[]
}

/** An option after an edit, plus the values whose rename the variant titles have yet to follow. */
export type UpdatedProductOption = {
  option: ProductOptionWithValuesDTO
  /** Empty unless a value's text changed. `ProductModuleService` retitles from this. */
  renamedValueIds: string[]
}

type InjectedDependencies = {
  productRepository: ProductRepository
  productVariantRepository: ProductVariantRepository
  productOptionRepository: ProductOptionRepository
  productOptionValueRepository: ProductOptionValueRepository
  productProductOptionRepository: ProductProductOptionRepository
  productProductOptionValueRepository: ProductProductOptionValueRepository
  productVariantOptionRepository: ProductVariantOptionRepository
  withTransaction: WithTransaction
  logger: Logger
}

/**
 * The option catalogue, the options a product offers, and the combinations they make.
 *
 * Split out of `ProductModuleService` because it is a whole subject on its own: three layers of
 * table, five deletion rules and five integrity rules, all documented in `docs/product-options.md`.
 * It stays inside the product module rather than becoming one, because its tables carry foreign
 * keys to `product` and `product_variant` — and the cascade graph is built per module from a single
 * models barrel, so tables that reference each other have to share one.
 *
 * **Internal to the module.** `ProductModuleService` constructs it and holds it privately; it is
 * not registered in any container, not re-exported from the services barrel, and not resolvable.
 * The module's public surface is `IProductModuleService` and nothing else, so this file is free to
 * change shape without anything outside the module noticing.
 *
 * **It never writes to the `product_variant` table.** It reads variants freely, since a combination
 * is only "taken" or "free" relative to them, and it owns the pivot that says which value a variant
 * carries. But a variant's own columns — its title above all — belong to `ProductModuleService`.
 * That one rule is what keeps the dependency between the two pointing in a single direction.
 */
export class ProductOptionService {
  private productRepository: ProductRepository
  private productVariantRepository: ProductVariantRepository
  private productOptionRepository: ProductOptionRepository
  private productOptionValueRepository: ProductOptionValueRepository
  private productProductOptionRepository: ProductProductOptionRepository
  private productProductOptionValueRepository: ProductProductOptionValueRepository
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
    this.productVariantOptionRepository = productVariantOptionRepository
    this.withTransaction = withTransaction
    this.logger = logger
  }

  // ── Options (global) ────────────────────────────────────────────────────

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
  ): Promise<UpdatedProductOption> {
    return this.withTransaction(context, async (ctx) => {
      const { values: valueInputs, ...optionData } = data

      const option =
        Object.keys(optionData).length > 0
          ? await this.productOptionRepository.update(optionId, optionData, ctx)
          : await this.productOptionRepository.findByIdOrFail(optionId, undefined, ctx)

      if (valueInputs) {
        const { values, renamedValueIds } = await this.replaceOptionValues(optionId, valueInputs, ctx)
        return { option: { ...option, values }, renamedValueIds }
      }

      const values = await this.productOptionValueRepository.find({ optionId }, { order: { rank: 'ASC' } }, ctx)
      return { option: { ...option, values }, renamedValueIds: [] }
    })
  }

  async softDeleteProductOptions(optionIds: string[], context?: Context): Promise<void> {
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

  // ── Option values ───────────────────────────────────────────────────────

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

  // ── A product's options ─────────────────────────────────────────────────

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

    const allValues = await this.productOptionValueRepository.find(
      { optionId: optionIds },
      { order: { rank: 'ASC' } },
      context,
    )

    const optionById = new Map(options.map((option) => [option.id, option]))

    return productOptionLinks.flatMap((link) => {
      const option = optionById.get(link.optionId)
      if (!option) return []

      // Exactly the values this product offers. An option offering none used to mean "all of
      // them", which I4 now forbids outright — a saved option always names its values.
      const offered = new Set(
        valueLinks.filter((value) => value.productProductOptionId === link.id).map((value) => value.optionValueId),
      )
      return { ...option, values: allValues.filter((value) => offered.has(value.id)) }
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

    const resolved = await this.resolveGlobalOptionIds(links, context)

    const counts: Record<string, number> = {}
    for (const link of links) {
      const optionValueId = resolved.get(link.productProductOptionValueId)?.optionValueId
      if (optionValueId) counts[optionValueId] = (counts[optionValueId] ?? 0) + 1
    }
    return counts
  }

  /**
   * Brings the product's option rows in line with the payload, keeping every row it still names.
   *
   * Replacing them wholesale is simpler and is what this used to do. It cannot survive the pivot:
   * a variant's option values hang off these rows, so deleting and recreating an option the
   * payload kept would cascade straight through them and strip every variant of its identity on an
   * unrelated edit. Surviving rows therefore keep their ids, and only what the payload dropped is
   * deleted — which is also what lets a plan computed before the write still name what it meant.
   */
  async writeProductOptions(productId: string, data: SetProductOptionsDTO, context: Context): Promise<void> {
    const existing = await this.productProductOptionRepository.find({ productId }, undefined, context)
    const offeredOptionIds = new Set(data.options.map((option) => option.optionId))

    const dropped = existing.filter((productOption) => !offeredOptionIds.has(productOption.optionId))
    if (dropped.length > 0) {
      await this.productProductOptionRepository.softDelete(
        dropped.map((productOption) => productOption.id),
        context,
      )
    }

    const existingByOptionId = new Map(existing.map((productOption) => [productOption.optionId, productOption]))

    await Promise.all(
      data.options.map(async ({ optionId, valueIds }, rank) => {
        const productOption = await this.upsertProductOption(
          { productId, optionId, rank },
          existingByOptionId.get(optionId),
          context,
        )
        await this.writeProductOptionValues(productOption.id, valueIds, context)
      }),
    )
  }

  // ── The variant-option pivot ────────────────────────────────────────────

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

    const resolved = await this.resolveGlobalOptionIds(links, context)
    const optionValueIds = links.flatMap((link) => resolved.get(link.productProductOptionValueId)?.optionValueId ?? [])
    if (optionValueIds.length === 0) return []

    return this.productOptionValueRepository.find({ id: optionValueIds }, { order: { rank: 'ASC' } }, context)
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
    const resolved = await this.resolveGlobalOptionIds(links, context)

    const maps: Record<string, Record<string, string>> = Object.fromEntries(variantIds.map((id) => [id, {}]))
    for (const link of links) {
      const map = maps[link.variantId]
      const global = resolved.get(link.productProductOptionValueId)
      if (map && global) map[global.optionId] = global.optionValueId
    }
    return maps
  }

  /**
   * Which variants carry any of these global option values.
   *
   * Two hops, because a variant carries its product's value rather than the global one: which
   * products offer these values, then which variants carry the rows standing for them. Exists so
   * `retitleVariantsCarrying` can find its work without reaching into the pivot itself.
   */
  async listVariantIdsCarrying(optionValueIds: string[], context?: Context): Promise<string[]> {
    if (optionValueIds.length === 0) return []

    const productOptionValues = await this.productProductOptionValueRepository.find(
      { optionValueId: optionValueIds },
      undefined,
      context,
    )
    if (productOptionValues.length === 0) return []

    const links = await this.productVariantOptionRepository.find(
      { productProductOptionValueId: productOptionValues.map((value) => value.id) },
      undefined,
      context,
    )
    return [...new Set(links.map((link) => link.variantId))]
  }

  /**
   * Full replace of a variant's pivot rows. Recreating after a soft delete is legal because every
   * unique index on the pivot is partial on `deleted_at IS NULL`.
   *
   * The pivot points at the product's option and value, so this is where the global ids a
   * combination is expressed in are resolved into the rows this product actually offers.
   */
  async replaceVariantOptionValues(
    variant: { id: string; productId: string },
    links: ReadonlyArray<{ optionId: string; optionValueId: string }>,
    context: Context,
  ): Promise<void> {
    const existing = await this.productVariantOptionRepository.find({ variantId: variant.id }, undefined, context)
    if (existing.length > 0) {
      await this.productVariantOptionRepository.softDelete(
        existing.map((link) => link.id),
        context,
      )
    }
    if (links.length === 0) return

    const { productOptionValueIdByOptionValueId } = await this.resolveProductOptionRows(variant.productId, context)

    await this.productVariantOptionRepository.createMany(
      links.map(({ optionValueId }) => {
        const productProductOptionValueId = productOptionValueIdByOptionValueId.get(optionValueId)

        // Unreachable through a resolver — every link came from a combination built out of the very
        // rows being looked up here. So it is an invariant rather than a bad payload: reaching it
        // means a caller skipped the resolvers, and it lands here instead of on a foreign-key
        // violation naming a column it never set.
        if (!productProductOptionValueId) {
          throw new AppError({
            type: ErrorTypes.UNEXPECTED_STATE,
            message: `Variant "${variant.id}" was given option value "${optionValueId}", which its product does not offer.`,
          })
        }

        return { variantId: variant.id, productProductOptionValueId }
      }),
      context,
    )
  }

  // ── Combinations ────────────────────────────────────────────────────────

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
  async resolveCombinationsForCreate(
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
  async resolveCombinationsForUpdate(
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
    this.assertEveryOptionOffersAValue(data)

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

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** The Product-Scoped Options a `setProductOptions` payload would leave behind, in payload order. */
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
      const values = allValues.filter((value) => value.optionId === entry.optionId && entry.valueIds.includes(value.id))
      return { id: option.id, title: option.title, values }
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

  /** The product's row for one option: kept as it is, re-ranked, or created. */
  private async upsertProductOption(
    wanted: { productId: string; optionId: string; rank: number },
    kept: ProductProductOptionDTO | undefined,
    context: Context,
  ): Promise<ProductProductOptionDTO> {
    if (!kept) return this.productProductOptionRepository.create(wanted, context)
    if (kept.rank === wanted.rank) return kept
    return this.productProductOptionRepository.update(kept.id, { rank: wanted.rank }, context)
  }

  /** The value half of `writeProductOptions`, keeping the rows the payload still names. */
  private async writeProductOptionValues(
    productProductOptionId: string,
    valueIds: readonly string[],
    context: Context,
  ): Promise<void> {
    // Queried unconditionally: an option created a moment ago has no values, so the read costs one
    // indexed lookup and saves the caller having to tell this which case it is in.
    const existing = await this.productProductOptionValueRepository.find({ productProductOptionId }, undefined, context)

    const offered = new Set(valueIds)
    const dropped = existing.filter((value) => !offered.has(value.optionValueId))
    if (dropped.length > 0) {
      await this.productProductOptionValueRepository.softDelete(
        dropped.map((value) => value.id),
        context,
      )
    }

    const alreadyOffered = new Set(existing.map((value) => value.optionValueId))
    const added = valueIds.filter((optionValueId) => !alreadyOffered.has(optionValueId))
    if (added.length === 0) return

    await this.productProductOptionValueRepository.createMany(
      added.map((optionValueId) => ({ productProductOptionId, optionValueId })),
      context,
    )
  }

  /**
   * I4: an option a product offers offers at least one value.
   *
   * An option with nothing to choose from is not a dimension the product varies along, and it
   * multiplies the combination count to zero — so before this rule, saving one planned the deletion
   * of every variant the product had. The admin already drops an option when its last value is
   * deselected; this is what makes that the only representable state rather than the polite one.
   */
  private assertEveryOptionOffersAValue(data: SetProductOptionsDTO): void {
    const empty = data.options.filter((option) => option.valueIds.length === 0)
    if (empty.length === 0) return

    throw new AppError({
      type: ErrorTypes.INVALID_DATA,
      message: `Option(s) ${empty.map((option) => option.optionId).join(', ')} were sent with no values. An option a product offers must offer at least one; drop the option instead.`,
    })
  }

  /**
   * The product's own value rows, keyed by the global value each stands for.
   *
   * A variant's option values point at the product layer, so every write has to translate the
   * global ids a payload names into the rows this product offers. Keying by the global value id
   * alone is safe: a value belongs to one option, and a product offers an option once.
   */
  private async resolveProductOptionRows(
    productId: string,
    context?: Context,
  ): Promise<{ productOptionValueIdByOptionValueId: Map<string, string> }> {
    const productOptions = await this.productProductOptionRepository.find({ productId }, undefined, context)
    if (productOptions.length === 0) return { productOptionValueIdByOptionValueId: new Map() }

    const productOptionValues = await this.productProductOptionValueRepository.find(
      { productProductOptionId: productOptions.map((productOption) => productOption.id) },
      undefined,
      context,
    )

    return {
      productOptionValueIdByOptionValueId: new Map(productOptionValues.map((row) => [row.optionValueId, row.id])),
    }
  }

  /**
   * The global option and value each pivot row stands for, keyed by the row's product value id.
   *
   * Two hops rather than one: the pivot names only the product's value, so which option that value
   * belongs to has to be read from the value itself. It used to be denormalised onto the pivot —
   * see the TODO on `product_variant_option`.
   */
  private async resolveGlobalOptionIds(
    links: ReadonlyArray<{ productProductOptionValueId: string }>,
    context?: Context,
  ): Promise<Map<string, { optionId: string; optionValueId: string }>> {
    if (links.length === 0) return new Map()

    const productOptionValues = await this.productProductOptionValueRepository.find(
      { id: [...new Set(links.map((link) => link.productProductOptionValueId))] },
      undefined,
      context,
    )
    if (productOptionValues.length === 0) return new Map()

    const productOptions = await this.productProductOptionRepository.find(
      { id: [...new Set(productOptionValues.map((value) => value.productProductOptionId))] },
      undefined,
      context,
    )
    const optionIdByProductOptionId = new Map(productOptions.map((row) => [row.id, row.optionId]))

    return new Map(
      productOptionValues.flatMap((value) => {
        const optionId = optionIdByProductOptionId.get(value.productProductOptionId)
        if (!optionId) return []
        return [[value.id, { optionId, optionValueId: value.optionValueId }] as const]
      }),
    )
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
  ): Promise<{ values: ProductOptionValueDTO[]; renamedValueIds: string[] }> {
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

    // Reported, not acted on: a variant's title is a variant column, and this service does not
    // write those. `ProductModuleService.updateProductOption` retitles from what comes back.
    const values = await this.productOptionValueRepository.find({ optionId }, { order: { rank: 'ASC' } }, context)
    return { values, renamedValueIds: renamedIds }
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
