import type { BigNumber } from '../../db/bignum.js'
import type { BaseFilterable, OperatorMap } from '../common.js'

export type OrderStatus = 'pending' | 'completed' | 'canceled' | 'archived'
export type OrderFulfillmentStatus = 'unfulfilled' | 'fulfilled' | 'shipped' | 'delivered'

export type OrderDTO = {
  id: string
  displayId: number
  status: OrderStatus
  fulfillmentStatus: OrderFulfillmentStatus
  email: string | null
  customerId: string | null
  currencyCode: string
  shippingAddressId: string | null
  billingAddressId: string | null
  canceledAt: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableOrderProps extends BaseFilterable<FilterableOrderProps> {
  id?: string | string[]
  displayId?: number | OperatorMap<number>
  status?: OrderStatus | OrderStatus[]
  fulfillmentStatus?: OrderFulfillmentStatus | OrderFulfillmentStatus[]
  customerId?: string | string[]
  email?: string | OperatorMap<string>
  currencyCode?: string | string[]
  createdAt?: OperatorMap<Date>
}

export type OrderAddressDTO = {
  id: string
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

export type OrderLineItemDTO = {
  id: string
  orderId: string
  title: string
  subtitle: string | null
  thumbnail: string | null
  quantity: number
  unitPrice: BigNumber
  compareAtUnitPrice: BigNumber | null
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
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableOrderLineItemProps extends BaseFilterable<FilterableOrderLineItemProps> {
  id?: string | string[]
  orderId?: string | string[]
  variantId?: string | string[]
  productId?: string | string[]
  createdAt?: OperatorMap<Date>
}

export type OrderShippingMethodDTO = {
  id: string
  orderId: string
  name: string
  description: string | null
  amount: BigNumber
  shippingOptionId: string | null
  data: unknown
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableOrderShippingMethodProps extends BaseFilterable<FilterableOrderShippingMethodProps> {
  id?: string | string[]
  orderId?: string | string[]
  shippingOptionId?: string | string[]
}

export type OrderTransactionDTO = {
  id: string
  orderId: string
  amount: BigNumber
  currencyCode: string
  reference: string | null
  referenceId: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableOrderTransactionProps extends BaseFilterable<FilterableOrderTransactionProps> {
  id?: string | string[]
  orderId?: string | string[]
  reference?: string | string[]
  currencyCode?: string | string[]
  createdAt?: OperatorMap<Date>
}

export type OrderTotals = {
  itemsTotal: BigNumber
  shippingTotal: BigNumber
  orderTotal: BigNumber
  paidTotal: BigNumber
}
