import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  FilterableProductOptionProps,
  FilterableProductOptionValueProps,
  FilterableProductProps,
  FilterableProductVariantProps,
  ProductDTO,
  ProductImageDTO,
  ProductOptionDTO,
  ProductOptionValueDTO,
  ProductOptionWithValuesDTO,
  ProductVariantDTO,
} from './common.js'
import type {
  CreateProductDTO,
  CreateProductImageDTO,
  CreateProductOptionDTO,
  CreateProductOptionValueDTO,
  CreateProductVariantDTO,
  SetProductOptionsDTO,
  UpdateProductDTO,
  UpdateProductOptionDTO,
  UpdateProductVariantDTO,
  UpsertProductVariantDTO,
} from './mutations.js'

export type IProductModuleService = {
  // Products
  listProducts(
    filters?: FilterableProductProps,
    config?: FindConfig<ProductDTO>,
    context?: Context,
  ): Promise<ProductDTO[]>
  listAndCountProducts(
    filters?: FilterableProductProps,
    config?: FindConfig<ProductDTO>,
    context?: Context,
  ): Promise<[ProductDTO[], number]>
  retrieveProduct(productId: string, config?: FindConfig<ProductDTO>, context?: Context): Promise<ProductDTO>
  createProducts(data: CreateProductDTO[], context?: Context): Promise<ProductDTO[]>
  updateProducts(productIds: string[], data: UpdateProductDTO, context?: Context): Promise<ProductDTO[]>
  createProduct(data: CreateProductDTO, context?: Context): Promise<ProductDTO>
  updateProduct(productId: string, data: UpdateProductDTO, context?: Context): Promise<ProductDTO>
  deleteProducts(productIds: string[], context?: Context): Promise<void>

  // Variants
  createProductVariants(data: CreateProductVariantDTO[], context?: Context): Promise<ProductVariantDTO[]>
  createProductVariant(data: CreateProductVariantDTO, context?: Context): Promise<ProductVariantDTO>
  listProductVariants(
    filters?: FilterableProductVariantProps,
    config?: FindConfig<ProductVariantDTO>,
    context?: Context,
  ): Promise<ProductVariantDTO[]>
  listAndCountProductVariants(
    filters?: FilterableProductVariantProps,
    config?: FindConfig<ProductVariantDTO>,
    context?: Context,
  ): Promise<[ProductVariantDTO[], number]>
  retrieveProductVariant(
    variantId: string,
    config?: FindConfig<ProductVariantDTO>,
    context?: Context,
  ): Promise<ProductVariantDTO>
  updateProductVariants(
    variantIds: string[],
    data: UpdateProductVariantDTO,
    context?: Context,
  ): Promise<ProductVariantDTO[]>
  updateProductVariant(variantId: string, data: UpdateProductVariantDTO, context?: Context): Promise<ProductVariantDTO>
  upsertProductVariants(data: UpsertProductVariantDTO[], context?: Context): Promise<ProductVariantDTO[]>
  deleteProductVariants(variantIds: string[], context?: Context): Promise<void>

  // Options (global)
  createProductOption(data: CreateProductOptionDTO, context?: Context): Promise<ProductOptionWithValuesDTO>
  createProductOptions(data: CreateProductOptionDTO[], context?: Context): Promise<ProductOptionDTO[]>
  listProductOptions(
    filters?: FilterableProductOptionProps,
    config?: FindConfig<ProductOptionDTO>,
    context?: Context,
  ): Promise<ProductOptionWithValuesDTO[]>
  listAndCountProductOptions(
    filters?: FilterableProductOptionProps,
    config?: FindConfig<ProductOptionDTO>,
    context?: Context,
  ): Promise<[ProductOptionWithValuesDTO[], number]>
  retrieveProductOption(optionId: string, context?: Context): Promise<ProductOptionWithValuesDTO>
  updateProductOption(
    optionId: string,
    data: UpdateProductOptionDTO,
    context?: Context,
  ): Promise<ProductOptionWithValuesDTO>
  deleteProductOptions(optionIds: string[], context?: Context): Promise<void>

  // Option values
  createProductOptionValues(data: CreateProductOptionValueDTO[], context?: Context): Promise<ProductOptionValueDTO[]>
  createProductOptionValue(data: CreateProductOptionValueDTO, context?: Context): Promise<ProductOptionValueDTO>
  listProductOptionValues(
    filters?: FilterableProductOptionValueProps,
    config?: FindConfig<ProductOptionValueDTO>,
    context?: Context,
  ): Promise<ProductOptionValueDTO[]>
  listAndCountProductOptionValues(
    filters?: FilterableProductOptionValueProps,
    config?: FindConfig<ProductOptionValueDTO>,
    context?: Context,
  ): Promise<[ProductOptionValueDTO[], number]>

  // Product-option linking
  setProductOptions(productId: string, data: SetProductOptionsDTO, context?: Context): Promise<void>
  listProductOptionsForProduct(productId: string, context?: Context): Promise<ProductOptionWithValuesDTO[]>
  listAndCountProductsForOption(
    optionId: string,
    filters?: FilterableProductProps,
    config?: FindConfig<ProductDTO>,
    context?: Context,
  ): Promise<[ProductDTO[], number]>

  // Images
  createProductImages(data: CreateProductImageDTO[], context?: Context): Promise<ProductImageDTO[]>
  createProductImage(data: CreateProductImageDTO, context?: Context): Promise<ProductImageDTO>
}
