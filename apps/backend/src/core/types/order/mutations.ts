import type { BigNumber } from '../../bignumber.js'
import type { OrderLineItemDTO, OrderLineItemOptionDTO, OrderShippingMethodDTO, OrderStatus } from './common.js'

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
  variantOptions?: OrderLineItemOptionDTO[] | undefined
  requiresShipping?: boolean | undefined
}

export type CreateOrderShippingMethodDTO = {
  name: string
  description?: string | null | undefined
  amount: BigNumber
  isTaxInclusive?: boolean | undefined
  shippingOptionId?: string | null | undefined
  data?: Record<string, unknown> | null | undefined
  isCustomAmount?: boolean | undefined
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
  /** Omitted, the Order is `pending`. A `draft` is created as a Draft Order (`isDraftOrder`). */
  status?: OrderStatus | undefined
  email?: string | null | undefined
  customerId?: string | null | undefined
  regionId?: string | null | undefined
  salesChannelId?: string | null | undefined
  currencyCode: string
  shippingAddress?: CreateOrderAddressDTO | undefined
  billingAddress?: CreateOrderAddressDTO | undefined
  items?: CreateOrderLineItemDTO[] | undefined
  shippingMethods?: CreateOrderShippingMethodDTO[] | undefined
}

export type UpdateOrderDTO = {
  status?: OrderStatus | undefined
  /** Cleared when a draft is converted; a canceled draft keeps it. */
  isDraftOrder?: boolean | undefined
  email?: string | null | undefined
  customerId?: string | null | undefined
  canceledAt?: Date | null | undefined
}

/** The fields an admin edits on a Draft Order beside its items and shipping. */
export type UpdateDraftOrderDTO = {
  email?: string | null | undefined
  /** Merged into the draft's shipping address, which is created when the Cart had none. */
  shippingAddress?: CreateOrderAddressDTO | undefined
}

/** What adding items to a draft wrote: the lines it started, and the ones it raised from a quantity. */
export type DraftOrderLineItemsAddition = {
  lineItems: OrderLineItemDTO[]
  createdIds: string[]
  previousQuantities: OrderLineItemQuantityDTO[]
}

export type OrderLineItemQuantityDTO = { id: string; quantity: number }

/** What setting a draft's shipping method wrote, and the methods it replaced. */
export type DraftOrderShippingMethodReplacement = {
  shippingMethod: OrderShippingMethodDTO
  replacedIds: string[]
}

/** A shipping method's amount as a refresh re-states it. */
export type OrderShippingMethodPriceUpdateDTO = { id: string; amount: BigNumber }

/** What a draft's shipping refresh writes: the methods re-priced, and the ones no longer available. */
export type OrderShippingMethodRefreshDTO = {
  update: OrderShippingMethodPriceUpdateDTO[]
  remove: string[]
}
