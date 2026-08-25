import type { BaseFilterable, OperatorMap } from '../common.js'
import type { PriceDTO } from '../pricing/common.js'

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
export type VariantRemovalReason = 'value-dropped' | 'collapsed'

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
export type ProductScopedOptionValueDTO = ProductOptionValueDTO & {
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

export interface FilterableProductProductOptionProps extends BaseFilterable<FilterableProductProductOptionProps> {
  id?: string | string[]
  productId?: string | string[]
  optionId?: string | string[]
}

export type ProductProductOptionValueDTO = {
  id: string
  productProductOptionId: string
  optionValueId: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableProductProductOptionValueProps
  extends BaseFilterable<FilterableProductProductOptionValueProps> {
  id?: string | string[]
  productProductOptionId?: string | string[]
  optionValueId?: string | string[]
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
