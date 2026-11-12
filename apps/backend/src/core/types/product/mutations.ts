import type {
  ProductFieldSource,
  ProductGroupingRuleDTO,
  ProductImportErrorDTO,
  ProductImportOptionsDTO,
  ProductImportSummaryDTO,
  ProductOptionRenderAs,
  ProductStatusType,
} from './common.js'

type CreateProductImageInput = {
  url: string
}

export type UpsertProductImageInput = {
  id?: string
  url: string
}

export type CreateProductDTO = {
  title: string
  handle?: string
  subtitle?: string | null
  description?: string | null
  isGiftcard?: boolean
  status?: ProductStatusType
  thumbnail?: string | null
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  originCountry?: string | null
  hsCode?: string | null
  midCode?: string | null
  material?: string | null
  discountable?: boolean
  externalId?: string | null
  metadata?: Record<string, unknown> | null
  images?: CreateProductImageInput[]
  /** The product's Product Type. */
  typeId?: string | null
  /** The product's brand, which the vendor field reads. */
  brand?: string | null
  metafields?: ProductMetafieldValuesDTO
} & ProductGroupingIdsDTO

export type UpdateProductDTO = {
  title?: string
  handle?: string
  subtitle?: string | null
  description?: string | null
  isGiftcard?: boolean
  status?: ProductStatusType
  thumbnail?: string | null
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  originCountry?: string | null
  hsCode?: string | null
  midCode?: string | null
  material?: string | null
  discountable?: boolean
  externalId?: string | null
  metadata?: Record<string, unknown> | null
  images?: UpsertProductImageInput[]
  /** `null` clears the Product Type. Absent leaves it alone. */
  typeId?: string | null
  /** `null` clears the brand. Absent leaves it alone. */
  brand?: string | null
  metafields?: ProductMetafieldValuesDTO
} & ProductGroupingIdsDTO

/**
 * A product's metafield values by definition key, `{ genero: ['men', 'unisex'] }`. Each key named
 * replaces that metafield's values, `[]` clears it, and keys left out are left alone. A key with no
 * definition is refused.
 */
export type ProductMetafieldValuesDTO = Record<string, string[]>

/** Creates the definition of `key`, or updates the one that exists. */
export type UpsertProductMetafieldDefinitionDTO = {
  key: string
  name: string
  /** Absent is not filterable. */
  filterable?: boolean
  /** Absent is a metafield. */
  source?: ProductFieldSource
}

/** The pivot-backed groupings a product write sets. Each replaces the product's whole set; absent leaves it alone. */
export type ProductGroupingIdsDTO = {
  categoryIds?: string[]
  collectionIds?: string[]
  tagIds?: string[]
}

export type CreateProductVariantDTO = {
  productId: string
  thumbnail?: string | null
  sku?: string | null
  barcode?: string | null
  ean?: string | null
  upc?: string | null
  allowBackorder?: boolean
  manageInventory?: boolean
  hsCode?: string | null
  originCountry?: string | null
  midCode?: string | null
  material?: string | null
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  variantRank?: number
  metadata?: Record<string, unknown> | null
  /**
   * The variant's Option Combination, keyed by option id. It must name every option the product
   * offers, so only a product with no options takes `{}`.
   */
  optionValues: Record<string, string>
}

export type UpdateProductVariantDTO = {
  thumbnail?: string | null
  sku?: string | null
  barcode?: string | null
  ean?: string | null
  upc?: string | null
  allowBackorder?: boolean
  manageInventory?: boolean
  hsCode?: string | null
  originCountry?: string | null
  midCode?: string | null
  material?: string | null
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  variantRank?: number
  metadata?: Record<string, unknown> | null
  /**
   * The variant's Option Combination, keyed by option id. Omit to leave an existing one untouched;
   * pass `{}` to clear it. When set it must name every option the product offers.
   */
  optionValues?: Record<string, string>
}

export type UpsertProductVariantDTO = CreateProductVariantDTO | ({ id: string } & UpdateProductVariantDTO)

export type CreateProductOptionDTO = {
  title: string
  renderAs?: ProductOptionRenderAs
  metadata?: Record<string, unknown> | null
  values?: Array<Omit<CreateProductOptionValueDTO, 'optionId'>>
}

export type UpdateProductOptionDTO = {
  title?: string
  renderAs?: ProductOptionRenderAs
  metadata?: Record<string, unknown> | null
  values?: UpsertProductOptionValueInput[]
}

/**
 * A value in an option's collection. A known `id` renames the value in place, keeping every
 * variant link intact; without one the value is created.
 */
export type UpsertProductOptionValueInput = { id?: string } & Omit<CreateProductOptionValueDTO, 'optionId'>

export type SetProductOptionsDTO = {
  /**
   * Array position sets each option's display rank on the product.
   *
   * `valueIds` must name at least one value. An option a product offers with nothing to choose
   * from is not a dimension the product varies along, and it multiplies the combination count to
   * zero — drop the option instead. The service refuses an empty one; the type cannot say so.
   */
  options: Array<{ optionId: string; valueIds: string[] }>
}

export type CreateProductOptionValueDTO = {
  optionId: string
  value: string
  rank?: number
  metadata?: Record<string, unknown> | null
}

export type CreateProductImageDTO = {
  productId: string
  url: string
  rank?: number
  metadata?: Record<string, unknown> | null
}

export type VariantImageInput = {
  imageId: string
  variantId: string
}

export type CreateProductCategoryDTO = {
  name: string
  /** Generated from the name when absent. */
  handle?: string
  description?: string
  /** Absent or null places the Category at the root. */
  parentId?: string | null
  /** Position among the new siblings. Absent appends. */
  rank?: number
  isActive?: boolean
  isInternal?: boolean
  /** Absent or null makes a manual Category. A rule fills it with the products that match. */
  rule?: ProductGroupingRuleDTO | null
}

/** Never regenerates the handle. */
export type UpdateProductCategoryDTO = {
  name?: string
  handle?: string
  description?: string
  /** Absent keeps the parent; null moves the Category to the root. */
  parentId?: string | null
  /** Position among the siblings it lands in. Absent appends when the parent changes. */
  rank?: number
  isActive?: boolean
  isInternal?: boolean
  /** A new rule re-matches every product. Null makes it manual and keeps the members it has. */
  rule?: ProductGroupingRuleDTO | null
}

/** Applied `add` then `remove`. Adding a member or removing a non-member is a no-op. */
export type SetCategoryProductsDTO = {
  add?: string[]
  remove?: string[]
}

export type CreateProductCollectionDTO = {
  title: string
  /** Generated from the title when absent. */
  handle?: string
  thumbnail?: string | null
  /** Absent or null makes a manual Collection. A rule fills it with the products that match. */
  rule?: ProductGroupingRuleDTO | null
}

/** Never regenerates the handle. */
export type UpdateProductCollectionDTO = {
  title?: string
  handle?: string
  thumbnail?: string | null
  /** A new rule re-matches every product. Null makes it manual and keeps the members it has. */
  rule?: ProductGroupingRuleDTO | null
}

/**
 * Which ruled memberships to recompute. Each absent list means all of its kind; an empty one means
 * none — so `{ categoryIds: [id], collectionIds: [] }` re-matches one Category against every product.
 */
export type SyncRuleMembershipsDTO = {
  productIds?: string[]
  categoryIds?: string[]
  collectionIds?: string[]
}

/** Applied `add` then `remove`. Adding a member or removing a non-member is a no-op. */
export type SetCollectionProductsDTO = {
  add?: string[]
  remove?: string[]
}

/** The value is stored as sent: uniqueness is exact and case-sensitive. */
export type CreateProductTypeDTO = {
  value: string
}

export type UpdateProductTypeDTO = {
  value?: string
}

/** The value is stored as sent: uniqueness is exact and case-sensitive. */
export type CreateProductTagDTO = {
  value: string
}

export type UpdateProductTagDTO = {
  value?: string
}

/** A previewed import. A job with `errors` is stored so the preview can show them, and never runs. */
export type CreateProductImportDTO = {
  fileId: string
  options: ProductImportOptionsDTO
  summary: ProductImportSummaryDTO
  errors: ProductImportErrorDTO[]
  chunks: string[]
  createdBy: string | null
}
