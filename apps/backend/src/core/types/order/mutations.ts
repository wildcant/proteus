import type { BigNumber } from '../../bignumber.js'
import type { OrderStatus } from './common.js'

export type CreateOrderAddressDTO = {
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

export type CreateOrderLineItemDTO = {
  title: string
  subtitle?: string | null | undefined
  thumbnail?: string | null | undefined
  quantity: number
  unitPrice: BigNumber
  compareAtUnitPrice?: BigNumber | null | undefined
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
}

export type CreateOrderShippingMethodDTO = {
  name: string
  description?: string | null | undefined
  amount: BigNumber
  shippingOptionId?: string | null | undefined
  data?: Record<string, unknown> | null | undefined
}

export type CreateOrderTransactionDTO = {
  orderId: string
  amount: BigNumber
  currencyCode: string
  reference?: string | null | undefined
  referenceId?: string | null | undefined
}

/** Addresses are nested rather than referenced: an order owns its addresses, so it has to exist
 *  before they can. `createOrder` writes the order and its addresses in one transaction. */
export type CreateOrderDTO = {
  email: string
  customerId?: string | null | undefined
  currencyCode: string
  shippingAddress?: CreateOrderAddressDTO | undefined
  billingAddress?: CreateOrderAddressDTO | undefined
  items?: CreateOrderLineItemDTO[] | undefined
  shippingMethods?: CreateOrderShippingMethodDTO[] | undefined
}

export type UpdateOrderDTO = {
  status?: OrderStatus | undefined
  email?: string | undefined
  customerId?: string | null | undefined
  canceledAt?: Date | null | undefined
}
