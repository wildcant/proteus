import { z } from 'zod'
import { bigNumberToString, dateToIso, timestamps } from '../../common.js'

export const OrderStatus = z.enum(['pending', 'completed', 'canceled', 'archived'])

export const OrderFulfillmentStatus = z.enum(['unfulfilled', 'fulfilled', 'shipped', 'delivered'])

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
    compareAtUnitPrice: bigNumberToString.nullable(),
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
    data: z.unknown(),
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
  })
  .openapi('AdminOrderAllowedActions')
export type AdminOrderAllowedActions = z.input<typeof AdminOrderAllowedActions>

export const AdminOrder = z
  .object({
    id: z.string(),
    displayId: z.number(),
    status: OrderStatus,
    fulfillmentStatus: OrderFulfillmentStatus,
    email: z.string().nullable(),
    customerId: z.string().nullable(),
    currencyCode: z.string(),
    canceledAt: dateToIso.nullable(),
    ...timestamps.shape,
  })
  .openapi('AdminOrder')
export type AdminOrder = z.input<typeof AdminOrder>
