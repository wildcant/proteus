import type { BigNumber } from '../../db/bignum.js'

export type CreateLineItemDTO = {
  title: string
  subtitle?: string | null | undefined
  thumbnail?: string | null | undefined
  quantity: number
  variantId?: string | null | undefined
  productId?: string | null | undefined
  productTitle?: string | null | undefined
  productDescription?: string | null | undefined
  productSubtitle?: string | null | undefined
  productType?: string | null | undefined
  productHandle?: string | null | undefined
  variantSku?: string | null | undefined
  variantBarcode?: string | null | undefined
  variantTitle?: string | null | undefined
  variantOptionValues?: string | null | undefined
  requiresShipping?: boolean | undefined
  isDiscountable?: boolean | undefined
  isGiftcard?: boolean | undefined
  isTaxInclusive?: boolean | undefined
  compareAtUnitPrice?: BigNumber | null | undefined
  unitPrice: BigNumber
  metadata?: string | null | undefined
}

export type UpdateLineItemDTO = {
  quantity?: number | undefined
  unitPrice?: BigNumber | undefined
  metadata?: string | null | undefined
}

export type CreateCartDTO = {
  regionId?: string | null | undefined
  customerId?: string | null | undefined
  salesChannelId?: string | null | undefined
  email?: string | null | undefined
  currencyCode: string
  shippingAddressId?: string | null | undefined
  billingAddressId?: string | null | undefined
  metadata?: string | null | undefined
  items?: CreateLineItemDTO[] | undefined
}

export type CreateShippingMethodDTO = {
  name: string
  description?: string | null | undefined
  amount: BigNumber
  isTaxInclusive?: boolean | undefined
  shippingOptionId?: string | null | undefined
  data?: string | null | undefined
  metadata?: string | null | undefined
}

export type UpdateCartDTO = {
  regionId?: string | null | undefined
  customerId?: string | null | undefined
  salesChannelId?: string | null | undefined
  email?: string | null | undefined
  currencyCode?: string | undefined
  status?: 'active' | 'completed' | 'abandoned' | undefined
  shippingAddressId?: string | null | undefined
  billingAddressId?: string | null | undefined
  metadata?: string | null | undefined
  completedAt?: Date | null | undefined
}
