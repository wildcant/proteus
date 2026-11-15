import { z } from 'zod'
import { bigNumberToString, dateToIso, nullableBigNumberToString, timestamps } from '../../common.js'

export const OrderStatus = z.enum(['draft', 'pending', 'completed', 'canceled', 'archived'])

export const OrderFulfillmentStatus = z.enum(['unfulfilled', 'fulfilled', 'shipped', 'delivered'])

/** One entry of the line's Option Combination, copied from the Cart line. */
export const AdminOrderLineItemOption = z
  .object({
    optionTitle: z.string(),
    renderAs: z.enum(['text', 'swatch']),
    value: z.string(),
  })
  .openapi('AdminOrderLineItemOption')
export type AdminOrderLineItemOption = z.input<typeof AdminOrderLineItemOption>

export const AdminOrderLineItem = z
  .object({
    id: z.string(),
    orderId: z.string(),
    title: z.string(),
    subtitle: z.string().nullable(),
    thumbnail: z.string().nullable(),
    quantity: z.number(),
    unitPrice: bigNumberToString,
    lineTotal: bigNumberToString,
    compareAtUnitPrice: nullableBigNumberToString,
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
    variantOptions: z.array(AdminOrderLineItemOption),
    requiresShipping: z.boolean(),
    ...timestamps.shape,
  })
  .openapi('AdminOrderLineItem')
export type AdminOrderLineItem = z.input<typeof AdminOrderLineItem>

export const AdminOrderShippingMethod = z
  .object({
    id: z.string(),
    orderId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    amount: bigNumberToString,
    shippingOptionId: z.string().nullable(),
    data: z.record(z.string(), z.unknown()).nullable(),
    /** The shop set this amount by hand, so editing a draft's items or address does not re-price it. */
    isCustomAmount: z.boolean(),
    ...timestamps.shape,
  })
  .openapi('AdminOrderShippingMethod')
export type AdminOrderShippingMethod = z.input<typeof AdminOrderShippingMethod>

export const AdminOrderTransaction = z
  .object({
    id: z.string(),
    orderId: z.string(),
    amount: bigNumberToString,
    currencyCode: z.string(),
    reference: z.string().nullable(),
    referenceId: z.string().nullable(),
    ...timestamps.shape,
  })
  .openapi('AdminOrderTransaction')
export type AdminOrderTransaction = z.input<typeof AdminOrderTransaction>

export const AdminOrderTotals = z
  .object({
    itemsTotal: bigNumberToString,
    shippingTotal: bigNumberToString,
    orderTotal: bigNumberToString,
    paidTotal: bigNumberToString,
    outstandingTotal: bigNumberToString,
  })
  .openapi('AdminOrderTotals')
export type AdminOrderTotals = z.input<typeof AdminOrderTotals>

export const AdminOrderAllowedActions = z
  .object({
    canComplete: z.boolean(),
    canCancel: z.boolean(),
    canArchive: z.boolean(),
    canFulfill: z.boolean(),
    canShip: z.boolean(),
    canMarkAsDelivered: z.boolean(),
  })
  .openapi('AdminOrderAllowedActions')
export type AdminOrderAllowedActions = z.input<typeof AdminOrderAllowedActions>

export const AdminOrderAddress = z
  .object({
    id: z.string(),
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
  })
  .openapi('AdminOrderAddress')
export type AdminOrderAddress = z.input<typeof AdminOrderAddress>

export const AdminOrderFulfillment = z
  .object({
    id: z.string(),
    providerId: z.string(),
    locationId: z.string().nullable(),
    shippedAt: dateToIso.nullable(),
    deliveredAt: dateToIso.nullable(),
    canceledAt: dateToIso.nullable(),
    ...timestamps.shape,
  })
  .openapi('AdminOrderFulfillment')
export type AdminOrderFulfillment = z.input<typeof AdminOrderFulfillment>

export const AdminOrder = z
  .object({
    id: z.string(),
    displayId: z.number(),
    /** The store's reference prefix followed by the display id, or the bare display id. */
    reference: z.string(),
    status: OrderStatus,
    /** Whether the Order began as a Draft Order and was never converted; a canceled draft keeps it. */
    isDraftOrder: z.boolean(),
    fulfillmentStatus: OrderFulfillmentStatus,
    email: z.string().nullable(),
    customerId: z.string().nullable(),
    regionId: z.string().nullable(),
    salesChannelId: z.string().nullable(),
    currencyCode: z.string(),
    canceledAt: dateToIso.nullable(),
    ...timestamps.shape,
  })
  .openapi('AdminOrder')
export type AdminOrder = z.input<typeof AdminOrder>

/** A Draft Order in the admin's drafts list: an Order the shop has not confirmed, so nothing is fulfilled. */
export const AdminDraftOrder = AdminOrder.omit({ fulfillmentStatus: true }).openapi('AdminDraftOrder')
export type AdminDraftOrder = z.input<typeof AdminDraftOrder>
