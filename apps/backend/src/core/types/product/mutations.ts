import type { ProductOptionRenderAs, ProductStatusType } from './common.js'

export type CreateProductImageInput = {
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
}

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
}

export type CreateProductVariantDTO = {
  productId: string
  /** Defaults to the Option Combination's label when omitted, e.g. `"M / White"`. */
  title?: string
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
  /** Omit to let the title follow the Option Combination when `optionValues` changes. */
  title?: string
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
  values?: Array<Omit<CreateProductOptionValueDTO, 'optionId'>>
}

export type SetProductOptionsDTO = {
  /** Array position sets each option's display rank on the product. */
  options: Array<{ optionId: string; valueIds: string[] }>
}

export type CreateProductOptionValueDTO = {
  optionId: string
  value: string
  rank?: number
  metadata?: Record<string, unknown> | null
}

export type UpdateProductOptionValueDTO = {
  value?: string
  rank?: number
  metadata?: Record<string, unknown> | null
}

export type CreateProductImageDTO = {
  productId: string
  url: string
  rank?: number
  metadata?: Record<string, unknown> | null
}

export type UpdateProductImageDTO = {
  url?: string
  rank?: number
  metadata?: Record<string, unknown> | null
}

export type VariantImageInput = {
  imageId: string
  variantId: string
}
