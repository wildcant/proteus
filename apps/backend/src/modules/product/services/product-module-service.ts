import type {
  Context,
  CreateProductDTO,
  CreateProductImageDTO,
  CreateProductOptionDTO,
  CreateProductOptionValueDTO,
  CreateProductVariantDTO,
  FilterableProductProps,
  FilterableProductVariantProps,
  FindConfig,
  IProductModuleService,
  ProductDTO,
  ProductImageDTO,
  ProductOptionDTO,
  ProductOptionValueDTO,
  ProductVariantDTO,
  UpdateProductDTO,
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
import type { ProductVariantRepository } from '../repositories/product-variant.js'

type InjectedDependencies = {
  productRepository: ProductRepository
  productVariantRepository: ProductVariantRepository
  productOptionRepository: ProductOptionRepository
  productOptionValueRepository: ProductOptionValueRepository
  productImageRepository: ProductImageRepository
  withTransaction: WithTransaction
  logger: Logger
}

export class ProductModuleService implements IProductModuleService {
  private productRepository: ProductRepository
  private productVariantRepository: ProductVariantRepository
  private productOptionRepository: ProductOptionRepository
  private productOptionValueRepository: ProductOptionValueRepository
  private productImageRepository: ProductImageRepository
  private withTransaction: WithTransaction
  private logger: Logger

  constructor({
    productRepository,
    productVariantRepository,
    productOptionRepository,
    productOptionValueRepository,
    productImageRepository,
    withTransaction,
    logger,
  }: InjectedDependencies) {
    this.productRepository = productRepository
    this.productVariantRepository = productVariantRepository
    this.productOptionRepository = productOptionRepository
    this.productOptionValueRepository = productOptionValueRepository
    this.productImageRepository = productImageRepository
    this.withTransaction = withTransaction
    this.logger = logger
  }

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

  async createProductOptions(data: CreateProductOptionDTO[], context?: Context): Promise<ProductOptionDTO[]> {
    this.logger.debug(`Creating ${data.length} product option(s)`)
    return this.withTransaction(context, async (ctx) => {
      return this.productOptionRepository.createMany(data, ctx)
    })
  }

  async createProductOption(data: CreateProductOptionDTO, context?: Context): Promise<ProductOptionDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.productOptionRepository.create(data, ctx)
    })
  }

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
}
