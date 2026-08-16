import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type {
  Context,
  CreateProductDTO,
  CreateProductImageDTO,
  CreateProductOptionDTO,
  CreateProductOptionValueDTO,
  CreateProductVariantDTO,
  FilterableProductOptionProps,
  FilterableProductOptionValueProps,
  FilterableProductProps,
  FilterableProductVariantProps,
  FindConfig,
  IProductModuleService,
  ProductDTO,
  ProductImageDTO,
  ProductOptionDTO,
  ProductOptionValueDTO,
  ProductOptionWithValuesDTO,
  ProductVariantDTO,
  SetProductOptionsDTO,
  UpdateProductDTO,
  UpdateProductOptionDTO,
  UpdateProductVariantDTO,
  UpsertProductVariantDTO,
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

type InjectedDependencies = {
  productRepository: ProductRepository
  productVariantRepository: ProductVariantRepository
  productOptionRepository: ProductOptionRepository
  productOptionValueRepository: ProductOptionValueRepository
  productProductOptionRepository: ProductProductOptionRepository
  productProductOptionValueRepository: ProductProductOptionValueRepository
  productImageRepository: ProductImageRepository
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
    const withHandles = data.map((d) => ({
      ...d,
      handle: d.handle ?? toHandle(d.title),
    }))
    return this.withTransaction(context, async (ctx) => {
      return this.productRepository.createMany(withHandles, ctx)
    })
  }

  async updateProducts(productIds: string[], data: UpdateProductDTO, context?: Context): Promise<ProductDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.productRepository.updateMany(productIds, data, ctx)
    })
  }

  async createProduct(data: CreateProductDTO, context?: Context): Promise<ProductDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.productRepository.create({ ...data, handle: data.handle ?? toHandle(data.title) }, ctx)
    })
  }

  async updateProduct(productId: string, data: UpdateProductDTO, context?: Context): Promise<ProductDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.productRepository.update(productId, data, ctx)
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
      return this.productVariantRepository.createMany(data, ctx)
    })
  }

  async createProductVariant(data: CreateProductVariantDTO, context?: Context): Promise<ProductVariantDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.productVariantRepository.create(data, ctx)
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
      return this.productVariantRepository.updateMany(variantIds, data, ctx)
    })
  }

  async updateProductVariant(
    variantId: string,
    data: UpdateProductVariantDTO,
    context?: Context,
  ): Promise<ProductVariantDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.productVariantRepository.update(variantId, data, ctx)
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

  // ── Product-Option Linking ────────────────────────────────────────────

  async setProductOptions(productId: string, data: SetProductOptionsDTO, context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
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

      for (const { optionId, valueIds } of data.options) {
        const link = await this.productProductOptionRepository.create({ productId, optionId }, ctx)
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
    const productOptionLinks = await this.productProductOptionRepository.find({ productId }, undefined, context)
    if (productOptionLinks.length === 0) return []

    const optionIds = productOptionLinks.map((l) => l.optionId)
    const options = await this.productOptionRepository.find({ id: optionIds }, undefined, context)

    const linkIds = productOptionLinks.map((l) => l.id)
    const valueLinks = await this.productProductOptionValueRepository.find(
      { productProductOptionId: linkIds },
      undefined,
      context,
    )

    const linkByOptionId = new Map(productOptionLinks.map((l) => [l.optionId, l.id]))
    const allowedValueIds = new Set(valueLinks.map((vl) => vl.optionValueId))

    const allValues = await this.productOptionValueRepository.find(
      { optionId: optionIds },
      { order: { rank: 'ASC' } },
      context,
    )

    return options.map((option) => {
      const linkId = linkByOptionId.get(option.id)
      const hasValueLinks = valueLinks.some((vl) => vl.productProductOptionId === linkId)
      const values = hasValueLinks
        ? allValues.filter((v) => v.optionId === option.id && allowedValueIds.has(v.id))
        : allValues.filter((v) => v.optionId === option.id)
      return { ...option, values }
    })
  }

  // ── Images ────────────────────────────────────────────────────────────

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

  // ── Helpers ───────────────────────────────────────────────────────────

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
