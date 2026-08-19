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
}

export type UpdateLineItemDTO = {
  quantity?: number | undefined
  unitPrice?: BigNumber | undefined
}

export type CreateCartDTO = {
  regionId?: string | null | undefined
  customerId?: string | null | undefined
  salesChannelId?: string | null | undefined
  email?: string | null | undefined
  currencyCode: string
  shippingAddressId?: string | null | undefined
  billingAddressId?: string | null | undefined
  items?: CreateLineItemDTO[] | undefined
}

export type CreateShippingMethodDTO = {
  name: string
  description?: string | null | undefined
  amount: BigNumber
  isTaxInclusive?: boolean | undefined
  shippingOptionId?: string | null | undefined
  data?: Record<string, unknown> | null | undefined
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
  completedAt?: Date | null | undefined
}

export type CreateCartAddressDTO = {
  customerId?: string | null | undefined
  company?: string | null | undefined
  firstName?: string | null | undefined
  lastName?: string | null | undefined
  address1?: string | null | undefined
  address2?: string | null | undefined
  city?: string | null | undefined
  countryCode?: string | null | undefined
  province?: string | null | undefined
  postalCode?: string | null | undefined
  phone?: string | null | undefined
}

export type UpdateCartAddressDTO = Partial<CreateCartAddressDTO>
