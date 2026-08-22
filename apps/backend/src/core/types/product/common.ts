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

export type ProductVariantOptionDTO = {
  id: string
  variantId: string
  optionId: string
  optionValueId: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableProductVariantOptionProps extends BaseFilterable<FilterableProductVariantOptionProps> {
  id?: string | string[]
  variantId?: string | string[]
  optionId?: string | string[]
  optionValueId?: string | string[]
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
