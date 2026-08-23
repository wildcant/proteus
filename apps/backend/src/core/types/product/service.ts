import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  EnrichedProductVariantDTO,
  FilterableProductImageProps,
  FilterableProductOptionCombinationProps,
  FilterableProductOptionProps,
  FilterableProductOptionValueProps,
  FilterableProductProps,
  FilterableProductVariantImageProps,
  FilterableProductVariantOptionProps,
  FilterableProductVariantProps,
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
  VariantReconciliationPlanDTO,
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
  VariantImageInput,
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
  /** What a proposed set of options would do to the product's variants. Reads only. */
  planProductOptionChange(
    productId: string,
    data: SetProductOptionsDTO,
    context?: Context,
  ): Promise<VariantReconciliationPlanDTO>
  /** Moves variants onto the combinations a plan assigned them, retitling as it goes. */
  applyVariantReassignments(
    reassignments: ReadonlyArray<{ variantId: string; optionValues: Record<string, string> }>,
    context?: Context,
  ): Promise<void>
  /** Brings every variant carrying one of these option values back in line with its combination. */
  retitleVariantsCarrying(optionValueIds: string[], context?: Context): Promise<void>
  listProductOptionsForProduct(productId: string, context?: Context): Promise<ProductOptionWithValuesDTO[]>
  listAndCountProductsForOption(
    optionId: string,
    filters?: FilterableProductProps,
    config?: FindConfig<ProductDTO>,
    context?: Context,
  ): Promise<[ProductDTO[], number]>

  // Images
  listProductImages(
    filters?: FilterableProductImageProps,
    config?: FindConfig<ProductImageDTO>,
    context?: Context,
  ): Promise<ProductImageDTO[]>
  createProductImages(data: CreateProductImageDTO[], context?: Context): Promise<ProductImageDTO[]>
  createProductImage(data: CreateProductImageDTO, context?: Context): Promise<ProductImageDTO>

  // Variant images
  listProductVariantImages(
    filters?: FilterableProductVariantImageProps,
    config?: FindConfig<ProductVariantImageDTO>,
    context?: Context,
  ): Promise<ProductVariantImageDTO[]>
  listImagesForVariant(variantId: string, context?: Context): Promise<ProductImageDTO[]>
  listVariantsForImage(imageId: string, context?: Context): Promise<ProductVariantDTO[]>
  addImageToVariant(data: VariantImageInput[], context?: Context): Promise<{ id: string }[]>
  removeImageFromVariant(data: VariantImageInput[], context?: Context): Promise<void>

  // Variant options
  listProductVariantOptions(
    filters?: FilterableProductVariantOptionProps,
    config?: FindConfig<ProductVariantOptionDTO>,
    context?: Context,
  ): Promise<ProductVariantOptionDTO[]>
  listOptionValuesForVariant(variantId: string, context?: Context): Promise<ProductOptionValueDTO[]>
  /**
   * Attaches each variant's Option Combination, resolved for display. Async because it lives in a
   * pivot rather than on the variant row — one batched read for the whole set.
   */
  enrichVariant(variant: ProductVariantDTO, context?: Context): Promise<EnrichedProductVariantDTO>
  enrichVariants(variants: ProductVariantDTO[], context?: Context): Promise<EnrichedProductVariantDTO[]>
  /**
   * Each variant's Option Combination as an id map — the lean form the storefront ships, where the
   * picker only ever compares ids and the labels already travel once on the product's options.
   */
  listVariantOptionMaps(variantIds: string[], context?: Context): Promise<Record<string, Record<string, string>>>
  /** How many of the product's variants carry each option value, keyed by option value id. */
  countVariantsByOptionValue(productId: string, context?: Context): Promise<Record<string, number>>
  /** The product's options with each value's variant usage attached. */
  listProductScopedOptions(productId: string, context?: Context): Promise<ProductScopedOptionDTO[]>
  /**
   * The Option Combinations this product could sell, each naming the variant that has it or `null`
   * while it is still available. Paginated and searched here because the count is the product of
   * the option value counts.
   */
  listProductOptionCombinations(
    filters: FilterableProductOptionCombinationProps,
    config?: FindConfig<ProductOptionCombinationDTO>,
    context?: Context,
  ): Promise<ProductOptionCombinationPageDTO>
  /** The storefront picker, precomputed over the variants the caller is actually shipping. */
  buildProductPickerTargets(
    productId: string,
    variants: readonly PickerVariantDTO[],
    context?: Context,
  ): Promise<Record<string, Record<string, string | null>>>
}
