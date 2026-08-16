import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  FilterableProductProps,
  FilterableProductVariantProps,
  ProductDTO,
  ProductImageDTO,
  ProductOptionDTO,
  ProductOptionValueDTO,
  ProductVariantDTO,
} from './common.js'
import type {
  CreateProductDTO,
  CreateProductImageDTO,
  CreateProductOptionDTO,
  CreateProductOptionValueDTO,
  CreateProductVariantDTO,
  UpdateProductDTO,
  UpdateProductVariantDTO,
  UpsertProductVariantDTO,
} from './mutations.js'

export type IProductModuleService = {
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
  createProductOptions(data: CreateProductOptionDTO[], context?: Context): Promise<ProductOptionDTO[]>
  createProductOption(data: CreateProductOptionDTO, context?: Context): Promise<ProductOptionDTO>
  createProductOptionValues(data: CreateProductOptionValueDTO[], context?: Context): Promise<ProductOptionValueDTO[]>
  createProductOptionValue(data: CreateProductOptionValueDTO, context?: Context): Promise<ProductOptionValueDTO>
  createProductImages(data: CreateProductImageDTO[], context?: Context): Promise<ProductImageDTO[]>
  createProductImage(data: CreateProductImageDTO, context?: Context): Promise<ProductImageDTO>
}
