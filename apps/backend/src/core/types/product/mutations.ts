import type { ProductStatusType } from './common.js'

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
  metadata?: string | null
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
  metadata?: string | null
}

export type CreateProductVariantDTO = {
  productId: string
  title: string
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
  metadata?: string | null
}

export type UpdateProductVariantDTO = {
  title?: string
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
  metadata?: string | null
}

export type UpsertProductVariantDTO = CreateProductVariantDTO | ({ id: string } & UpdateProductVariantDTO)

export type CreateProductOptionDTO = {
  productId: string
  title: string
  metadata?: string | null
}

export type UpdateProductOptionDTO = {
  title?: string
  metadata?: string | null
}

export type CreateProductOptionValueDTO = {
  optionId: string
  value: string
  rank?: number
  metadata?: string | null
}

export type UpdateProductOptionValueDTO = {
  value?: string
  rank?: number
  metadata?: string | null
}

export type CreateProductImageDTO = {
  productId: string
  url: string
  rank?: number
  metadata?: string | null
}

export type UpdateProductImageDTO = {
  url?: string
  rank?: number
  metadata?: string | null
}
