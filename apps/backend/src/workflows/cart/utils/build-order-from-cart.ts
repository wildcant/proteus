import type { CartAddressDTO, CartDTO, CartLineItemDTO, CartShippingMethodDTO } from '@core/types/cart/common.js'
import type { CreateOrderAddressDTO, CreateOrderDTO, CreateOrderLineItemDTO } from '@core/types/order/mutations.js'

type OrderFromCartSources = {
  cart: Pick<CartDTO, 'customerId' | 'regionId' | 'salesChannelId' | 'currencyCode'>
  email: string | null
  addresses: CartAddressDTO[]
  lineItems: CartLineItemDTO[]
  shippingMethods: CartShippingMethodDTO[]
}

/**
 * The order's addresses are rows it owns, so they are nested into the creation payload rather than
 * created first and pointed at — the order has to exist before they can. Copied field by field, so
 * editing the cart's address later cannot rewrite the order's.
 */
function snapshotAddress(source: CartAddressDTO | undefined): CreateOrderAddressDTO | undefined {
  if (!source) return undefined
  const { id, cartId, type, createdAt, updatedAt, deletedAt, ...fields } = source
  return fields
}

/**
 * A line as the Order stores it, field by field: a Cart's line at checkout or when it becomes a
 * Draft Order, and a line built for a draft the way add-to-cart builds one. What the Order doesn't
 * keep (the Cart's own ids, the gift-card and discount flags) stays behind.
 */
export function toOrderLineItem(line: CreateOrderLineItemDTO): CreateOrderLineItemDTO {
  return {
    title: line.title,
    subtitle: line.subtitle,
    thumbnail: line.thumbnail,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    compareAtUnitPrice: line.compareAtUnitPrice,
    variantId: line.variantId,
    productId: line.productId,
    productTitle: line.productTitle,
    productDescription: line.productDescription,
    productSubtitle: line.productSubtitle,
    productType: line.productType,
    productHandle: line.productHandle,
    variantSku: line.variantSku,
    variantBarcode: line.variantBarcode,
    variantTitle: line.variantTitle,
    variantOptionValues: line.variantOptionValues,
    variantOptions: line.variantOptions,
    requiresShipping: line.requiresShipping,
  }
}

/**
 * A Cart as the Order it becomes: its lines with their titled options, its addresses, its shipping
 * methods as stored (the provider's data included), and the region, sales channel, currency and
 * customer it was priced for. Checkout and turning a Cart into a Draft Order both snapshot it this
 * way; the caller says which status the Order starts in.
 */
export function buildOrderFromCart({
  cart,
  email,
  addresses,
  lineItems,
  shippingMethods,
}: OrderFromCartSources): Omit<CreateOrderDTO, 'status'> {
  return {
    email,
    customerId: cart.customerId,
    regionId: cart.regionId,
    salesChannelId: cart.salesChannelId,
    currencyCode: cart.currencyCode,
    shippingAddress: snapshotAddress(addresses.find((address) => address.type === 'shipping')),
    billingAddress: snapshotAddress(addresses.find((address) => address.type === 'billing')),
    items: lineItems.map(toOrderLineItem),
    shippingMethods: shippingMethods.map((method) => ({
      name: method.name,
      description: method.description,
      amount: method.amount,
      isTaxInclusive: method.isTaxInclusive,
      shippingOptionId: method.shippingOptionId,
      data: method.data ?? undefined,
    })),
  }
}
