import type { BigNumber } from '../../bignumber.js'
import type { BaseFilterable, OperatorMap } from '../common.js'
import type { ProductOptionRenderAs } from '../product/common.js'

export type OrderStatus = 'draft' | 'pending' | 'completed' | 'canceled' | 'archived'
export type OrderFulfillmentStatus = 'unfulfilled' | 'fulfilled' | 'shipped' | 'delivered'

export type OrderDTO = {
  id: string
  displayId: number
  status: OrderStatus
  isDraftOrder: boolean
  email: string | null
  customerId: string | null
  regionId: string | null
  salesChannelId: string | null
  currencyCode: string
  canceledAt: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableOrderProps extends BaseFilterable<FilterableOrderProps> {
  id?: string | string[]
  displayId?: number | OperatorMap<number>
  status?: OrderStatus | OrderStatus[] | OperatorMap<OrderStatus>
  isDraftOrder?: boolean
  customerId?: string | string[]
  email?: string | OperatorMap<string>
  currencyCode?: string | string[]
  createdAt?: OperatorMap<Date>
}

/** Which of the order's two address slots a snapshot fills. */
export type OrderAddressType = 'shipping' | 'billing'

export type OrderAddressDTO = {
  id: string
  orderId: string
  type: OrderAddressType
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

export interface FilterableOrderAddressProps extends BaseFilterable<FilterableOrderAddressProps> {
  id?: string | string[]
  orderId?: string | string[]
  type?: OrderAddressType | OrderAddressType[]
}

/** One entry of the line's Option Combination, copied from the Cart line it was ordered from. */
export type OrderLineItemOptionDTO = {
  optionTitle: string
  /** How the option draws its values: a `swatch` value reads alone, a `text` one beside its title. */
  renderAs: ProductOptionRenderAs
  value: string
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
  variantOptions: OrderLineItemOptionDTO[]
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
  /** Whether `amount` already includes tax, as the option's provider priced it. */
  isTaxInclusive: boolean
  shippingOptionId: string | null
  data: Record<string, unknown> | null
  /** The shop set this amount by hand, so re-pricing leaves it alone. */
  isCustomAmount: boolean
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
  referenceId?: string | string[]
  currencyCode?: string | string[]
  createdAt?: OperatorMap<Date>
}

export type ComputeOrderTotalsDTO = {
  lineItems: OrderLineItemDTO[]
  shippingMethods: OrderShippingMethodDTO[]
  transactions: OrderTransactionDTO[]
}

export type OrderTotals = {
  itemsTotal: BigNumber
  shippingTotal: BigNumber
  orderTotal: BigNumber
  paidTotal: BigNumber
  outstandingTotal: BigNumber
}

/** Medusa's order payment status, aggregated from the Order's payment collections. */
export type PaymentStatus =
  | 'not_paid'
  | 'awaiting'
  | 'authorized'
  | 'partially_authorized'
  | 'partially_captured'
  | 'captured'
  | 'partially_refunded'
  | 'refunded'
  | 'canceled'
  | 'requires_action'

export type EnrichedOrderLineItemDTO = OrderLineItemDTO & { lineTotal: BigNumber }

/** A Draft Order with what the shop reads to confirm it: its lines, shipping, address and totals. */
export type DraftOrderDetailDTO = OrderDTO & {
  lineItems: EnrichedOrderLineItemDTO[]
  shippingMethods: OrderShippingMethodDTO[]
  shippingAddress: OrderAddressDTO | null
  totals: OrderTotals
}

export type OrderAllowedActions = {
  canComplete: boolean
  canCancel: boolean
  canArchive: boolean
  canFulfill: boolean
  canShip: boolean
  canMarkAsDelivered: boolean
}
