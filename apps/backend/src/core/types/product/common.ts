import type { BaseFilterable, OperatorMap } from '../common.js'
import type { PriceDTO } from '../pricing/common.js'

export type ProductStatusType = 'draft' | 'proposed' | 'published' | 'rejected'

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
  metadata: string | null
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
  metadata: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type ProductVariantExtendedDTO = ProductVariantDTO & { prices?: PriceDTO[] }

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
  metadata: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type ProductOptionWithValuesDTO = ProductOptionDTO & {
  values: ProductOptionValueDTO[]
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
  metadata: string | null
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
  metadata: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableProductImageProps extends BaseFilterable<FilterableProductImageProps> {
  id?: string | string[]
  productId?: string | string[]
  url?: string | OperatorMap<string>
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
