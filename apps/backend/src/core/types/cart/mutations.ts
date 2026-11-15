import type { BigNumber } from '../../bignumber.js'
import type { CartLineItemOptionDTO } from './common.js'

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
  productSubline?: string | null | undefined
  productHandle?: string | null | undefined
  variantSku?: string | null | undefined
  variantBarcode?: string | null | undefined
  variantTitle?: string | null | undefined
  variantOptionValues?: string | null | undefined
  variantOptions?: CartLineItemOptionDTO[] | undefined
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

/** One line item and the patch meant for it alone. */
export type LineItemUpdateDTO = {
  id: string
  data: UpdateLineItemDTO
}

/**
 * An addition to a cart, split into the lines it starts and the lines it raises.
 *
 * Both halves land on `cart_line_item`, so they are written together or not at all — a cart
 * holding half of an addition is worse than one that refused it outright.
 */
export type CartLineItemPlanDTO = {
  create: CreateLineItemDTO[]
  merge: LineItemUpdateDTO[]
}

export type CreateCartDTO = {
  regionId?: string | null | undefined
  customerId?: string | null | undefined
  salesChannelId?: string | null | undefined
  email?: string | null | undefined
  currencyCode: string
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

/** A shipping method's price, and the provider's data that price was based on, as a refresh re-states them. */
export type ShippingMethodPriceUpdateDTO = {
  id: string
  amount: BigNumber
  isTaxInclusive: boolean
  data: Record<string, unknown> | null
}

/**
 * What a shipping method refresh writes: the methods it re-prices and the ones it drops because
 * their option no longer serves the cart.
 */
export type ShippingMethodRefreshDTO = {
  update: ShippingMethodPriceUpdateDTO[]
  remove: string[]
}

export type UpdateCartDTO = {
  regionId?: string | null | undefined
  customerId?: string | null | undefined
  salesChannelId?: string | null | undefined
  email?: string | null | undefined
  currencyCode?: string | undefined
  completedAt?: Date | null | undefined
}

export type CreateCartAddressDTO = {
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

export type UpdateCartWithAddressesDTO = {
  customerId?: string | null | undefined
  email?: string | null | undefined
  shippingAddress?: CreateCartAddressDTO | undefined
  billingAddress?: CreateCartAddressDTO | undefined
}
