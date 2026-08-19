import { z } from 'zod'
import { bigNumberToString, dateToIso, timestamps } from '../../common.js'

export const StoreCart = z
  .object({
    id: z.string(),
    regionId: z.string().nullable(),
    customerId: z.string().nullable(),
    salesChannelId: z.string().nullable(),
    email: z.string().nullable(),
    currencyCode: z.string(),
    status: z.string(),
    shippingAddressId: z.string().nullable(),
    billingAddressId: z.string().nullable(),
    completedAt: dateToIso.nullable(),
    ...timestamps.shape,
  })
  .openapi('StoreCart')
export type StoreCart = z.input<typeof StoreCart>

export const StoreCartLineItem = z
  .object({
    id: z.string(),
    cartId: z.string(),
    title: z.string(),
    subtitle: z.string().nullable(),
    thumbnail: z.string().nullable(),
    quantity: z.number(),
    variantId: z.string().nullable(),
    productId: z.string().nullable(),
    productTitle: z.string().nullable(),
    productDescription: z.string().nullable(),
    productSubtitle: z.string().nullable(),
    productType: z.string().nullable(),
    productHandle: z.string().nullable(),
    variantSku: z.string().nullable(),
    variantBarcode: z.string().nullable(),
    variantTitle: z.string().nullable(),
    variantOptionValues: z.string().nullable(),
    requiresShipping: z.boolean(),
    isDiscountable: z.boolean(),
    isGiftcard: z.boolean(),
    isTaxInclusive: z.boolean(),
    compareAtUnitPrice: bigNumberToString.nullable(),
    unitPrice: bigNumberToString,
    lineTotal: bigNumberToString,
    ...timestamps.shape,
  })
  .openapi('StoreCartLineItem')
export type StoreCartLineItem = z.input<typeof StoreCartLineItem>

export const StoreCartShippingMethod = z
  .object({
    id: z.string(),
    cartId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    amount: bigNumberToString,
    isTaxInclusive: z.boolean(),
    shippingOptionId: z.string().nullable(),
    data: z.record(z.string(), z.unknown()).nullable(),
    ...timestamps.shape,
  })
  .openapi('StoreCartShippingMethod')
export type StoreCartShippingMethod = z.input<typeof StoreCartShippingMethod>

export const StoreCartTotals = z
  .object({
    itemsTotal: bigNumberToString,
    shippingTotal: bigNumberToString,
    cartTotal: bigNumberToString,
  })
  .openapi('StoreCartTotals')
export type StoreCartTotals = z.input<typeof StoreCartTotals>

export const StoreCartAddress = z
  .object({
    id: z.string(),
    customerId: z.string().nullable(),
    company: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    address1: z.string().nullable(),
    address2: z.string().nullable(),
    city: z.string().nullable(),
    countryCode: z.string().nullable(),
    province: z.string().nullable(),
    postalCode: z.string().nullable(),
    phone: z.string().nullable(),
    ...timestamps.shape,
  })
  .openapi('StoreCartAddress')
export type StoreCartAddress = z.input<typeof StoreCartAddress>

export const StoreConfirmInventoryItem = z
  .object({
    lineItemId: z.string(),
    variantId: z.string(),
    inventoryItemId: z.string(),
    requiredQuantity: z.number(),
    quantity: z.number(),
    locationIds: z.array(z.string()),
  })
  .openapi('StoreConfirmInventoryItem')
export type StoreConfirmInventoryItem = z.input<typeof StoreConfirmInventoryItem>
