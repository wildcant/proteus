import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  AppliedProductOptionChangeDTO,
  CatalogStructureChangesDTO,
  CatalogStructureDTO,
  CatalogStructurePlanDTO,
  EnrichedProductVariantDTO,
  FilterableProductCategoryProps,
  FilterableProductCollectionProps,
  FilterableProductImageProps,
  FilterableProductOptionCombinationProps,
  FilterableProductOptionProps,
  FilterableProductOptionValueProps,
  FilterableProductProps,
  FilterableProductTagProps,
  FilterableProductTypeProps,
  FilterableProductVariantImageProps,
  FilterableProductVariantOptionProps,
  FilterableProductVariantProps,
  ImportedProductDTO,
  ListCategoryTreeDTO,
  PickerVariantDTO,
  ProductCategoryDTO,
  ProductCategoryTreeNodeDTO,
  ProductCollectionDTO,
  ProductDTO,
  ProductFieldGroupDTO,
  ProductFilterDTO,
  ProductGroupingsDTO,
  ProductImageDTO,
  ProductImportDTO,
  ProductImportOutcomeDTO,
  ProductImportPlanDTO,
  ProductImportReferencesDTO,
  ProductImportSettingsDTO,
  ProductMetafieldDefinitionDTO,
  ProductMetafieldDTO,
  ProductOptionCombinationDTO,
  ProductOptionCombinationPageDTO,
  ProductOptionDTO,
  ProductOptionValueDTO,
  ProductOptionWithValuesDTO,
  ProductScopedOptionDTO,
  ProductTagDTO,
  ProductTypeDTO,
  ProductVariantDTO,
  ProductVariantImageDTO,
  ProductVariantOptionDTO,
  VariantReassignmentDTO,
  VariantReconciliationPlanDTO,
} from './common.js'
import type {
  CreateProductCategoryDTO,
  CreateProductCollectionDTO,
  CreateProductDTO,
  CreateProductImageDTO,
  CreateProductImportDTO,
  CreateProductOptionDTO,
  CreateProductOptionValueDTO,
  CreateProductTagDTO,
  CreateProductTypeDTO,
  CreateProductVariantDTO,
  SetCategoryProductsDTO,
  SetCollectionProductsDTO,
  SetProductOptionsDTO,
  SyncRuleMembershipsDTO,
  UpdateProductCategoryDTO,
  UpdateProductCollectionDTO,
  UpdateProductDTO,
  UpdateProductOptionDTO,
  UpdateProductTagDTO,
  UpdateProductTypeDTO,
  UpdateProductVariantDTO,
  UpsertProductMetafieldDefinitionDTO,
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
  softDeleteProducts(productIds: string[], context?: Context): Promise<void>

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
  softDeleteProductVariants(variantIds: string[], context?: Context): Promise<void>
  /** The variant's own thumbnail, falling back to its product's. Null when the variant is unknown or neither carries an image. */
  resolveVariantThumbnail(variantId: string, context?: Context): Promise<string | null>

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
  softDeleteProductOptions(optionIds: string[], context?: Context): Promise<void>

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
  /**
   * Replaces which options a product offers and which of their values, and moves its variants onto
   * them. Refused when the change does not fit the variants the product has — see
   * `applyProductOptionChange` for the path that resolves that instead of refusing.
   */
  setProductOptions(productId: string, data: SetProductOptionsDTO, context?: Context): Promise<void>
  /**
   * The same change, applied together with the variant moves it forces, as one transaction.
   * Reports the variants it could not keep rather than removing them, because that reaches modules
   * this one cannot.
   */
  applyProductOptionChange(
    productId: string,
    data: SetProductOptionsDTO,
    context?: Context,
  ): Promise<AppliedProductOptionChangeDTO>
  /** Puts a product's options and its variants' combinations back as they were. Compensation only. */
  revertProductOptionChange(
    productId: string,
    options: SetProductOptionsDTO,
    combinations: readonly VariantReassignmentDTO[],
    context?: Context,
  ): Promise<void>
  /** What a proposed set of options would do to the product's variants. Reads only. */
  planProductOptionChange(
    productId: string,
    data: SetProductOptionsDTO,
    context?: Context,
  ): Promise<VariantReconciliationPlanDTO>
  /** Moves variants onto the combinations a plan assigned them, retitling as it goes. */
  applyVariantReassignments(reassignments: readonly VariantReassignmentDTO[], context?: Context): Promise<void>
  /** Brings every variant carrying one of these option values back in line with its combination. */
  retitleVariantsCarrying(optionValueIds: string[], context?: Context): Promise<void>
  listProductOptionsForProduct(productId: string, context?: Context): Promise<ProductOptionWithValuesDTO[]>
  listAndCountProductsForOption(
    optionId: string,
    filters?: FilterableProductProps,
    config?: FindConfig<ProductDTO>,
    context?: Context,
  ): Promise<[ProductDTO[], number]>

  // Categories
  /**
   * Every live Category, nested under its parent, siblings in rank order. `visibleOnly` keeps the
   * Visible ones — active, not internal, every ancestor visible.
   */
  listCategoryTree(filters?: ListCategoryTreeDTO, context?: Context): Promise<ProductCategoryTreeNodeDTO[]>
  /** Live Categories matching `filters`, flat, in sibling rank order. */
  listCategories(filters?: FilterableProductCategoryProps, context?: Context): Promise<ProductCategoryDTO[]>
  retrieveCategory(categoryId: string, context?: Context): Promise<ProductCategoryDTO>
  /** Places the new Category among its siblings and renumbers the set 0..n-1. */
  createCategory(data: CreateProductCategoryDTO, context?: Context): Promise<ProductCategoryDTO>
  updateCategory(categoryId: string, data: UpdateProductCategoryDTO, context?: Context): Promise<ProductCategoryDTO>
  /** Refused with `NOT_ALLOWED` while a Category still has live children. */
  softDeleteCategories(categoryIds: string[], context?: Context): Promise<void>
  /**
   * Adds then removes direct members. Adding a member or removing a non-member is a no-op. Refused
   * with `NOT_ALLOWED` for a ruled Category.
   */
  setCategoryProducts(categoryId: string, data: SetCategoryProductsDTO, context?: Context): Promise<ProductCategoryDTO>

  // Imports
  /**
   * Reads a Shopify-format CSV into a plan: what the import would create, update and skip, every
   * error with its line, and the products in chunks. Writes nothing.
   */
  planProductImport(
    source: AsyncIterable<Uint8Array | string>,
    settings: ProductImportSettingsDTO,
    context?: Context,
  ): Promise<ProductImportPlanDTO>
  createProductImport(data: CreateProductImportDTO, context?: Context): Promise<ProductImportDTO>
  retrieveProductImport(importId: string, context?: Context): Promise<ProductImportDTO>
  /** `previewed` → `importing`. Refused with `NOT_ALLOWED` for a job with errors, one past its hour, or one not previewed. */
  confirmProductImport(importId: string, context?: Context): Promise<ProductImportDTO>
  /** `previewed` → `canceled`, refused with `NOT_ALLOWED` otherwise. */
  cancelProductImport(importId: string, context?: Context): Promise<ProductImportDTO>
  /** Marks every preview older than an hour `expired` and returns them, so their files can go. */
  expireProductImports(context?: Context): Promise<ProductImportDTO[]>
  /** Adds one product's outcome to the job's counters, and its error to the job's list. */
  recordProductImportOutcome(importId: string, outcome: ProductImportOutcomeDTO, context?: Context): Promise<void>
  /** `importing` → `completed`, or `failed` when no product made it in. A finished job is returned unchanged. */
  finishProductImport(importId: string, context?: Context): Promise<ProductImportDTO>
  /** The ids the product's handles, values and option titles name, creating the ones that do not exist. */
  resolveProductImportReferences(product: ImportedProductDTO, context?: Context): Promise<ProductImportReferencesDTO>

  // Collections
  listAndCountCollections(
    filters?: FilterableProductCollectionProps,
    config?: FindConfig<ProductCollectionDTO>,
    context?: Context,
  ): Promise<[ProductCollectionDTO[], number]>
  retrieveCollection(collectionId: string, context?: Context): Promise<ProductCollectionDTO>
  createCollection(data: CreateProductCollectionDTO, context?: Context): Promise<ProductCollectionDTO>
  updateCollection(
    collectionId: string,
    data: UpdateProductCollectionDTO,
    context?: Context,
  ): Promise<ProductCollectionDTO>
  /** Hides the Collections' memberships with them; the products stay. */
  softDeleteCollections(collectionIds: string[], context?: Context): Promise<void>
  /**
   * Adds then removes members. Adding a member or removing a non-member is a no-op. Refused with
   * `NOT_ALLOWED` for a ruled Collection.
   */
  setCollectionProducts(
    collectionId: string,
    data: SetCollectionProductsDTO,
    context?: Context,
  ): Promise<ProductCollectionDTO>

  // Product Types
  listAndCountTypes(
    filters?: FilterableProductTypeProps,
    config?: FindConfig<ProductTypeDTO>,
    context?: Context,
  ): Promise<[ProductTypeDTO[], number]>
  retrieveType(typeId: string, context?: Context): Promise<ProductTypeDTO>
  createType(data: CreateProductTypeDTO, context?: Context): Promise<ProductTypeDTO>
  updateType(typeId: string, data: UpdateProductTypeDTO, context?: Context): Promise<ProductTypeDTO>
  /** Allowed while in use: the products keep the id but read no Type, and line snapshots keep the text. */
  softDeleteTypes(typeIds: string[], context?: Context): Promise<void>

  // Product Tags
  listAndCountTags(
    filters?: FilterableProductTagProps,
    config?: FindConfig<ProductTagDTO>,
    context?: Context,
  ): Promise<[ProductTagDTO[], number]>
  retrieveTag(tagId: string, context?: Context): Promise<ProductTagDTO>
  createTag(data: CreateProductTagDTO, context?: Context): Promise<ProductTagDTO>
  updateTag(tagId: string, data: UpdateProductTagDTO, context?: Context): Promise<ProductTagDTO>
  /** Allowed while in use: the Tags' pivot rows are hidden with them, so their products lose them. */
  softDeleteTags(tagIds: string[], context?: Context): Promise<void>
  /**
   * The distinct live Tag values on the products matching `filters`, sorted — one `SELECT DISTINCT`.
   * The tag filter itself is not taken: the values offered must not narrow to the ones already chosen.
   */
  listProductTagValues(
    filters: Omit<FilterableProductProps, 'tagId' | 'tagValue'>,
    context?: Context,
  ): Promise<string[]>

  // Metafields
  /**
   * The storefront's filters over the products matching `filters`: each filterable definition, in rank
   * order, then each option those products offer, by title, keyed `option.<title>` — each with every
   * value those products hold and how many would remain once it is chosen. The `metafields`,
   * `optionValues` and `tagValue` selections narrow the counts, never which values are offered, and a
   * filter's own selection does not narrow its own counts.
   */
  listProductFilters(filters: FilterableProductProps, context?: Context): Promise<ProductFilterDTO[]>
  /**
   * The distinct values of the field `key` — a metafield, or the brand for the vendor field, filterable
   * or not — on the products matching `filters`, sorted. Empty for a key no definition has.
   */
  listProductFieldValues(key: string, filters: FilterableProductProps, context?: Context): Promise<string[]>
  /**
   * The values of the field `key` on the products matching `filters`, grouped by the field
   * `groupKey`: models by brand. Groups come most products first, and so do the values in each;
   * ties go alphabetically. Empty when either key has no definition.
   */
  listProductFieldGroups(
    key: string,
    groupKey: string,
    filters: FilterableProductProps,
    context?: Context,
  ): Promise<ProductFieldGroupDTO[]>
  /**
   * The values of the option titled `title` that the products matching `filters` offer, in the
   * option's own order (sizes small to large). Empty for a title no option has.
   */
  listOfferedOptionValues(title: string, filters: FilterableProductProps, context?: Context): Promise<string[]>
  /** The live metafield definitions, by key. */
  listMetafieldDefinitions(context?: Context): Promise<ProductMetafieldDefinitionDTO[]>
  /**
   * Creates each definition whose key is new and renames the ones that exist. Deletes nothing: the
   * structure file, which is the source, deletes the ones it leaves out when it is applied.
   */
  upsertMetafieldDefinitions(
    data: UpsertProductMetafieldDefinitionDTO[],
    context?: Context,
  ): Promise<ProductMetafieldDefinitionDTO[]>
  /** A product's metafields that hold values, by key. */
  retrieveProductMetafields(productId: string, context?: Context): Promise<ProductMetafieldDTO[]>

  /**
   * Makes every ruled Category and Collection in scope hold exactly the scoped products its rule
   * matches, in one transaction. Manual groupings are never touched. Product and rule writes call
   * it themselves; it is public for writes that change many groupings at once.
   */
  syncRuleMemberships(scope?: SyncRuleMembershipsDTO, context?: Context): Promise<void>

  // Structure files
  /**
   * Reads a structure file (`estructura.yaml`) into a plan: the structure, every error with its
   * path, and what applying it would create, update, move and delete. Writes nothing.
   */
  planCatalogStructure(source: AsyncIterable<Uint8Array | string>, context?: Context): Promise<CatalogStructurePlanDTO>
  /**
   * Makes the metafield definitions (by key), Categories and Collections (by handle) exactly the
   * structure's, in one transaction: named ones written as declared (Categories active, at their file
   * rank), absent ones deleted, then every ruled grouping re-matched. Answers with what changed. The
   * menu is not this module's.
   */
  applyCatalogStructure(structure: CatalogStructureDTO, context?: Context): Promise<CatalogStructureChangesDTO>

  /** One product's live groupings: `null` and empty lists where it has none. */
  retrieveProductGroupings(productId: string, context?: Context): Promise<ProductGroupingsDTO>

  /**
   * Each product's live groupings, keyed by product id — one query per relation over the whole list.
   * Every id asked about has an entry.
   */
  listProductGroupings(productIds: string[], context?: Context): Promise<Record<string, ProductGroupingsDTO>>

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
