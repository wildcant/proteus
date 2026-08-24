import type { BigNumber } from '../../db/bignum.js'
import type { BaseFilterable, OperatorMap } from '../common.js'

export type CartDTO = {
  id: string
  regionId: string | null
  customerId: string | null
  salesChannelId: string | null
  email: string | null
  currencyCode: string
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
  completedAt?: Date | null | OperatorMap<Date>
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
  data: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableCartShippingMethodProps extends BaseFilterable<FilterableCartShippingMethodProps> {
  id?: string | string[]
  cartId?: string | string[]
  shippingOptionId?: string | string[]
}

export type ComputeCartTotalsDTO = {
  lineItems: CartLineItemDTO[]
  shippingMethods: CartShippingMethodDTO[]
}

export type CartTotalsDTO = {
  itemsTotal: BigNumber
  shippingTotal: BigNumber
  cartTotal: BigNumber
}

export type EnrichedCartLineItemDTO = CartLineItemDTO & { lineTotal: BigNumber }

/** Which of the cart's two address slots a row fills. */
export type CartAddressType = 'shipping' | 'billing'

export type CartAddressDTO = {
  id: string
  cartId: string
  type: CartAddressType
  customerId: string | null
  company: string | null
  firstName: string | null
  lastName: string | null
  address1: string | null
  address2: string | null
  city: string | null
  countryCode: string | null
  province: string | null
  postalCode: string | null
  phone: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableCartAddressProps extends BaseFilterable<FilterableCartAddressProps> {
  id?: string | string[]
  cartId?: string | string[]
  type?: CartAddressType | CartAddressType[]
}
