import type { BigNumber } from '../../db/bignum.js'
import type { BaseFilterable, OperatorMap } from '../common.js'

export type CartStatus = 'active' | 'completed' | 'abandoned'

export type CartDTO = {
  id: string
  regionId: string | null
  customerId: string | null
  salesChannelId: string | null
  email: string | null
  currencyCode: string
  status: CartStatus
  shippingAddressId: string | null
  billingAddressId: string | null
  metadata: string | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableCartProps extends BaseFilterable<FilterableCartProps> {
  id?: string | string[]
  customerId?: string | string[]
  email?: string | OperatorMap<string>
  currencyCode?: string | string[]
  status?: CartStatus | CartStatus[]
  regionId?: string | string[]
  salesChannelId?: string | string[]
  createdAt?: OperatorMap<Date>
}

export type CartLineItemDTO = {
  id: string
  cartId: string
  title: string
  subtitle: string | null
  thumbnail: string | null
  quantity: number
  variantId: string | null
  productId: string | null
  productTitle: string | null
  productDescription: string | null
  productSubtitle: string | null
  productType: string | null
  productHandle: string | null
  variantSku: string | null
  variantBarcode: string | null
  variantTitle: string | null
  variantOptionValues: string | null
  requiresShipping: boolean
  isDiscountable: boolean
  isGiftcard: boolean
  isTaxInclusive: boolean
  compareAtUnitPrice: BigNumber | null
  unitPrice: BigNumber
  metadata: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableCartLineItemProps extends BaseFilterable<FilterableCartLineItemProps> {
  id?: string | string[]
  cartId?: string | string[]
  variantId?: string | string[]
  productId?: string | string[]
  createdAt?: OperatorMap<Date>
}

export type CartShippingMethodDTO = {
  id: string
  cartId: string
  name: string
  description: string | null
  amount: BigNumber
  isTaxInclusive: boolean
  shippingOptionId: string | null
  data: string | null
  metadata: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableCartShippingMethodProps extends BaseFilterable<FilterableCartShippingMethodProps> {
  id?: string | string[]
  cartId?: string | string[]
  shippingOptionId?: string | string[]
}
