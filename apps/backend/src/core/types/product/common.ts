import type { BaseFilterable, OperatorMap } from '../common.js'
import type { PriceDTO } from '../pricing/common.js'
import type { StoreNavigationEntryDTO } from '../store/common.js'

export type ProductStatusType = 'draft' | 'proposed' | 'published' | 'rejected'

/** How the storefront draws an option's values. */
export type ProductOptionRenderAs = 'text' | 'swatch'

export type ProductDTO = {
  id: string
  title: string
  handle: string
  subtitle: string | null
  description: string | null
  isGiftcard: boolean
  status: ProductStatusType
  thumbnail: string | null
  weight: number | null
  length: number | null
  height: number | null
  width: number | null
  originCountry: string | null
  hsCode: string | null
  midCode: string | null
  material: string | null
  discountable: boolean
  externalId: string | null
  metadata: Record<string, unknown> | null
  /** The product's Product Type. Can name a soft-deleted Type; `listProductGroupings` joins live ones only. */
  typeId: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableProductProps extends BaseFilterable<FilterableProductProps> {
  id?: string | string[]
  title?: string | OperatorMap<string>
  handle?: string | string[]
  status?: ProductStatusType | ProductStatusType[]
  isGiftcard?: boolean
  createdAt?: OperatorMap<Date>
  /** Products of any of these Product Types. */
  typeId?: string | string[]
  /** Direct members of any of these Categories. Not a column: `ProductRepository.extraWhere` applies it. */
  categoryId?: string | string[]
  /** Members of any of these Collections. Not a column: `ProductRepository.extraWhere` applies it. */
  collectionId?: string | string[]
  /** Members of any of the Collections with these handles. Not a column, as `collectionId`. */
  collectionHandle?: string | string[]
  /** Products carrying any of these Tags. Not a column: `ProductRepository.extraWhere` applies it. */
  tagId?: string | string[]
  /** Products carrying any of the Tags with these values. Not a column, as `tagId`. */
  tagValue?: string | string[]
  /** Members of any of the Categories with these handles. Not a column, as `categoryId`. */
  categoryHandle?: string | string[]
  /** Widens `categoryId` / `categoryHandle` to the matched Categories' descendants. */
  includeDescendants?: boolean
  /** Narrows `categoryId` / `categoryHandle` to Visible Categories: a hidden one matches nothing. */
  visibleOnly?: boolean
}

export type ProductVariantDTO = {
  id: string
  productId: string
  title: string
  thumbnail: string | null
  sku: string | null
  barcode: string | null
  ean: string | null
  upc: string | null
  allowBackorder: boolean
  manageInventory: boolean
  hsCode: string | null
  originCountry: string | null
  midCode: string | null
  material: string | null
  weight: number | null
  length: number | null
  height: number | null
  width: number | null
  variantRank: number | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type ProductVariantExtendedDTO = ProductVariantDTO & { prices?: PriceDTO[] }

/**
 * One entry of a variant's Option Combination, resolved for display: both the ids a client posts
 * back and the labels it renders. Always in the product's option order.
 */
export type VariantOptionValueDTO = {
  optionId: string
  optionTitle: string
  valueId: string
  value: string
}

/**
 * A variant with its Option Combination resolved from the `product_variant_option` pivot.
 *
 * Resolved rather than an id map because every admin surface renders labels — the variants table,
 * the detail card, the generated title. The storefront takes the lean map instead, via
 * `listVariantOptionMaps`.
 */
export type EnrichedProductVariantDTO = ProductVariantDTO & { optionValues: VariantOptionValueDTO[] }

/** An Option Combination a product could sell, and the variant that has it if one does. */
export type ProductOptionCombinationDTO = {
  key: string
  label: string
  values: VariantOptionValueDTO[]
  optionValues: Record<string, string>
  variantId: string | null
}

/**
 * The shape `buildProductPickerTargets` needs from each variant the caller is shipping.
 *
 * Named here rather than inlined at the two places that use it, so the port and its implementation
 * cannot drift. `inStock` is required, unlike the module's `CombinableVariant`: a caller building a
 * storefront picker has always resolved it.
 */
export type PickerVariantDTO = {
  id: string
  optionValues: Record<string, string>
  inStock: boolean
}

/**
 * Moving a variant onto a different Option Combination.
 *
 * Its identity — SKU, price, images, order history — survives; only which combination it stands
 * for changes. The map is empty when the variant is moving onto no combination at all, which is
 * what every option-less product's variant carries.
 */
export type VariantReassignmentDTO = {
  variantId: string
  optionValues: Record<string, string>
}

/** Why a variant cannot survive a change to its product's options. */
type VariantRemovalReason = 'value-dropped' | 'collapsed'

/**
 * What a proposed set of Product-Scoped Options would do to a product's variants. Structurally
 * mirrors the module's pure planner, the way `ProductOptionCombinationDTO` mirrors its combinations.
 */
export type VariantReconciliationPlanDTO = {
  keep: Array<{ variantId: string; combination: ProductOptionCombinationDTO }>
  reassign: Array<{ variantId: string; fromLabel: string; combination: ProductOptionCombinationDTO }>
  create: Array<{ combination: ProductOptionCombinationDTO; copyPricesFromVariantId: string | null }>
  remove: Array<{ variantId: string; title: string; reason: VariantRemovalReason }>
}

/**
 * What `applyProductOptionChange` did, and the one thing it deliberately did not do.
 *
 * `plan.remove` is a report rather than a record: removing a variant reaches price sets, links and
 * carts, which the module cannot touch, so the caller removes them once that cleanup is done.
 */
export type AppliedProductOptionChangeDTO = {
  plan: VariantReconciliationPlanDTO
  /** The variants the change created, in `plan.create` order, so prices can be copied onto them. */
  created: ProductVariantDTO[]
}

export interface FilterableProductOptionCombinationProps
  extends BaseFilterable<FilterableProductOptionCombinationProps> {
  /**
   * Required, unlike every other filter here: a combination only exists relative to one product's
   * option set, so there is no unscoped list to narrow.
   */
  productId: string
  /** Substring match on the combination's label, e.g. `"red"`. */
  label?: string
  /** `available` drops the combinations a variant already has. Defaults to all of them. */
  scope?: 'all' | 'available'
  /** Kept in an `available` list even though it is taken — the variant doing the editing. */
  variantId?: string
}

/**
 * A page of Option Combinations plus the two product-level totals every picker needs.
 *
 * Both totals ignore the filters, so a search that matches nothing stays distinguishable from a
 * product that has no options and from one whose combinations are all spoken for.
 */
export type ProductOptionCombinationPageDTO = {
  combinations: ProductOptionCombinationDTO[]
  /** Matching the filters — what pagination runs over. */
  count: number
  /** Every combination the product could sell. Zero means the product has no options yet. */
  totalCombinations: number
  /** Those still free, plus `variantId`'s own. Zero against a non-zero total means exhausted. */
  availableCombinations: number
}

export interface FilterableProductVariantProps extends BaseFilterable<FilterableProductVariantProps> {
  id?: string | string[]
  productId?: string | string[]
  sku?: string | string[] | OperatorMap<string>
  title?: string | OperatorMap<string>
  createdAt?: OperatorMap<Date>
}

export type ProductOptionDTO = {
  id: string
  title: string
  renderAs: ProductOptionRenderAs
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type ProductOptionWithValuesDTO = ProductOptionDTO & {
  values: ProductOptionValueDTO[]
}

/** A Product Option Value as one product offers it, with that product's usage attached. */
type ProductScopedOptionValueDTO = ProductOptionValueDTO & {
  /** Variants of this product carrying the value. Non-zero means it cannot be unlinked yet. */
  variantCount: number
}

/**
 * A Product Option as one particular product offers it — only the values that product sells, in
 * its own display order. Distinct from `ProductOptionDTO`, which is the global catalogue entity.
 */
export type ProductScopedOptionDTO = ProductOptionDTO & {
  values: ProductScopedOptionValueDTO[]
}

export interface FilterableProductOptionProps extends BaseFilterable<FilterableProductOptionProps> {
  id?: string | string[]
  title?: string | OperatorMap<string>
}

export type ProductOptionValueDTO = {
  id: string
  optionId: string
  value: string
  rank: number | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableProductOptionValueProps extends BaseFilterable<FilterableProductOptionValueProps> {
  id?: string | string[]
  optionId?: string | string[]
  value?: string | OperatorMap<string>
}

export type ProductProductOptionDTO = {
  id: string
  productId: string
  optionId: string
  rank: number
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type ProductImageDTO = {
  id: string
  productId: string
  url: string
  rank: number
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableProductImageProps extends BaseFilterable<FilterableProductImageProps> {
  id?: string | string[]
  productId?: string | string[]
  url?: string | OperatorMap<string>
}

/**
 * A variant's option value as the pivot stores it — pointing at the **product's** option and
 * value, not the global ones. Every other shape here speaks global ids; this is the one place the
 * product layer surfaces, because it mirrors the table.
 */
export type ProductVariantOptionDTO = {
  id: string
  variantId: string
  productProductOptionValueId: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableProductVariantOptionProps extends BaseFilterable<FilterableProductVariantOptionProps> {
  id?: string | string[]
  variantId?: string | string[]
  productProductOptionValueId?: string | string[]
}

export type ProductVariantImageDTO = {
  id: string
  variantId: string
  imageId: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableProductVariantImageProps extends BaseFilterable<FilterableProductVariantImageProps> {
  id?: string | string[]
  variantId?: string | string[]
  imageId?: string | string[]
}

/**
 * A rule: one condition per metafield key, every condition must hold, and a condition holds when the
 * product's metafield carries any one of its values — an AND of ORs.
 * `{ genero: ['hombre', 'unisex'], estilo: ['clasicos'] }` reads "(hombre or unisex) and clasicos".
 * Values match exactly, as they are stored.
 */
export type ProductGroupingRuleDTO = Record<string, string[]>

/** What a metafield holds. A list of short texts is the only kind, the one Shopify can filter on and build collections from. */
export type ProductMetafieldType = 'list.single_line_text_field'

/** A named product field ("Género", key `genero`), as the structure file's `campos` declare it. */
export type ProductMetafieldDefinitionDTO = {
  id: string
  namespace: string
  key: string
  name: string
  type: ProductMetafieldType
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

/** One of a product's metafields with its values, in the order they were written. */
export type ProductMetafieldDTO = {
  key: string
  name: string
  values: string[]
}

export type ProductCategoryDTO = {
  id: string
  name: string
  description: string
  handle: string
  parentId: string | null
  rank: number
  isActive: boolean
  isInternal: boolean
  /** `null` is manual: the members are picked. A ruled Category's members follow its rule. */
  rule: ProductGroupingRuleDTO | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type ListCategoryTreeDTO = {
  /** Only Visible Categories — active, not internal, every ancestor visible. The store's tree. */
  visibleOnly?: boolean
}

/** A Category with its children nested, siblings in rank order. */
export type ProductCategoryTreeNodeDTO = ProductCategoryDTO & {
  children: ProductCategoryTreeNodeDTO[]
}

export type ProductCollectionDTO = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  /** `null` is manual: the members are picked. A ruled Collection's members follow its rule. */
  rule: ProductGroupingRuleDTO | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableProductCollectionProps extends BaseFilterable<FilterableProductCollectionProps> {
  id?: string | string[]
  title?: string | OperatorMap<string>
  handle?: string | string[]
}

/** A Category as a structure file declares it, its children in file order. `rule` null is a manual Category. */
export type CatalogStructureCategoryDTO = {
  name: string
  handle: string
  rule: ProductGroupingRuleDTO | null
  children: CatalogStructureCategoryDTO[]
}

/** A Collection as a structure file declares it. `rule` null is a manual Collection. */
type CatalogStructureCollectionDTO = {
  name: string
  handle: string
  rule: ProductGroupingRuleDTO | null
}

/** A metafield definition as a structure file's `campos` declare it. */
type CatalogStructureMetafieldDTO = {
  name: string
  key: string
}

/**
 * The store's structure as `estructura.yaml` declares it: the metafield definitions its rules read,
 * the Category tree, the Collections and the menu. The file is the source: applying it makes the
 * catalogue's definitions and groupings exactly these.
 */
export type CatalogStructureDTO = {
  metafields: CatalogStructureMetafieldDTO[]
  categories: CatalogStructureCategoryDTO[]
  collections: CatalogStructureCollectionDTO[]
  menu: StoreNavigationEntryDTO[]
}

/** One problem with a structure file. `path` names where it is, `categorias[0].hijos[1].handle`. */
export type CatalogStructureErrorDTO = {
  path: string
  message: string
}

/** A Category the file creates, updates or deletes. `parentHandle` is where it ends up (for a delete, where it was). */
type CatalogStructureCategoryChangeDTO = {
  handle: string
  name: string
  parentHandle: string | null
}

/** A Category the file puts under another parent; it may change otherwise too. */
type CatalogStructureCategoryMoveDTO = CatalogStructureCategoryChangeDTO & {
  previousParentHandle: string | null
}

type CatalogStructureCollectionChangeDTO = {
  handle: string
  name: string
}

/**
 * What applying a structure does to the metafield definitions, by key, and to the groupings, by
 * handle. A definition update is a new name. A grouping update is a new name, rule, rank or an
 * inactive Category turned active; a move is a new parent, and is listed only as a move.
 */
export type CatalogStructureChangesDTO = {
  metafields: {
    create: CatalogStructureMetafieldDTO[]
    update: CatalogStructureMetafieldDTO[]
    delete: CatalogStructureMetafieldDTO[]
  }
  categories: {
    create: CatalogStructureCategoryChangeDTO[]
    update: CatalogStructureCategoryChangeDTO[]
    move: CatalogStructureCategoryMoveDTO[]
    delete: CatalogStructureCategoryChangeDTO[]
  }
  collections: {
    create: CatalogStructureCollectionChangeDTO[]
    update: CatalogStructureCollectionChangeDTO[]
    delete: CatalogStructureCollectionChangeDTO[]
  }
}

/** A structure file read against the catalogue. A file with errors has no structure, and changes nothing. */
export type CatalogStructurePlanDTO = {
  structure: CatalogStructureDTO | null
  errors: CatalogStructureErrorDTO[]
  changes: CatalogStructureChangesDTO
}

export type ProductTypeDTO = {
  id: string
  value: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableProductTypeProps extends BaseFilterable<FilterableProductTypeProps> {
  id?: string | string[]
  value?: string | string[] | OperatorMap<string>
}

export type ProductTagDTO = {
  id: string
  value: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableProductTagProps extends BaseFilterable<FilterableProductTagProps> {
  id?: string | string[]
  value?: string | string[] | OperatorMap<string>
}

/** What a product is grouped under, read for many products at once. */
export type ProductGroupingsDTO = {
  /** `null` when the product has none, or its Type was deleted. */
  type: ProductTypeDTO | null
  categories: ProductCategoryDTO[]
  collections: ProductCollectionDTO[]
  tags: ProductTagDTO[]
}

export type FilterableProductCategoryProps = {
  handle?: string | string[]
}

// ── Product imports ─────────────────────────────────────────────────────

/**
 * `previewed` is the only state a job can be confirmed or canceled from. `failed` means no product
 * made it in; a run where some products failed and others did not is `completed`, with the
 * failures on the job.
 */
export type ProductImportStatus = 'previewed' | 'importing' | 'completed' | 'failed' | 'canceled' | 'expired'

export type ProductImportOptionsDTO = {
  /** Products whose handle already exists are updated rather than skipped. */
  overwrite: boolean
  /** Active products are imported published rather than as drafts. */
  publish: boolean
}

/** One problem with the file or one product's import. `line` is the CSV line, the header being line 1. */
export type ProductImportErrorDTO = {
  line: number
  handle: string | null
  message: string
}

export type ImportedVariantDTO = {
  /** The CSV line the variant was read from. */
  line: number
  sku: string | null
  /** In the product's option order; empty for a product with no options. */
  optionValues: string[]
  weight: number | null
  manageInventory: boolean
  allowBackorder: boolean
  /** Units on hand at the default location; `null` leaves stock alone. */
  inventoryQuantity: number | null
  prices: Array<{ currencyCode: string; amount: number }>
  imageUrl: string | null
}

/** A product as the import file describes it, normalized from its rows. */
export type ImportedProductDTO = {
  /** The line of the product's first row. */
  line: number
  /** How many CSV rows the product spans, which is what chunks are sized by. */
  rows: number
  handle: string
  title: string
  description: string | null
  status: ProductStatusType
  type: string | null
  tags: string[]
  options: Array<{ title: string; values: string[] }>
  variants: ImportedVariantDTO[]
  /** In display order. */
  imageUrls: string[]
}

export type ProductImportSummaryDTO = {
  products: { create: number; update: number; skip: number }
  skus: number
  images: number
  /** Tags and types the file names that do not exist yet, created when the import runs. */
  willCreate: { tags: string[]; types: string[] }
  /** Columns present in the file that the import does not read. */
  ignoredColumns: string[]
  firstProduct: ImportedProductDTO | null
}

export type ProductImportDTO = {
  id: string
  /** The uploaded CSV. */
  fileId: string
  options: ProductImportOptionsDTO
  status: ProductImportStatus
  summary: ProductImportSummaryDTO
  /** File keys of the normalized product chunks the run reads, in order. */
  chunks: string[]
  created: number
  updated: number
  skipped: number
  failed: number
  errors: ProductImportErrorDTO[]
  /** The user who uploaded the file, and who is told when it finishes. */
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

/** What one product's import came to. */
export type ProductImportOutcomeDTO =
  | { outcome: 'created' | 'updated' | 'skipped' }
  | { outcome: 'failed'; error: ProductImportErrorDTO }

/** What an import file comes to before anything is written: the summary, every error, and the products in chunks. */
export type ProductImportPlanDTO = {
  summary: ProductImportSummaryDTO
  errors: ProductImportErrorDTO[]
  chunks: ImportedProductDTO[][]
}

/** The settings a file is read against: what each price column is quoted in. */
export type ProductImportSettingsDTO = ProductImportOptionsDTO & {
  /** The store's default currency, which the plain `Price` column is in. `null` when the store has none. */
  defaultCurrency: string | null
  /** Region currency by lower-cased region name, for `Price / <Market>` columns. */
  marketCurrencies: Record<string, string>
}

/** The ids an imported product's names resolve to, created where missing. */
export type ProductImportReferencesDTO = {
  /** The live product with the same handle, if any. */
  existingProductId: string | null
  typeId: string | null
  tagIds: string[]
  /** In the product's option order; `valueIds` line up with `ImportedProductDTO.options[].values`. */
  options: Array<{ optionId: string; valueIds: string[] }>
}
