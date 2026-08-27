import { z } from 'zod'
import { bigNumberToString, dateToIso, timestamps } from '../../common.js'

export const StoreOrderStatus = z.enum(['pending', 'completed', 'canceled', 'archived'])

export const StoreOrderFulfillmentStatus = z.enum(['unfulfilled', 'fulfilled', 'shipped', 'delivered'])

export const StoreOrderItemSummary = z
  .object({
    id: z.string(),
    title: z.string(),
    thumbnail: z.string().nullable(),
    quantity: z.number(),
  })
  .openapi('StoreOrderItemSummary')
export type StoreOrderItemSummary = z.input<typeof StoreOrderItemSummary>

export const StoreOrderLineItem = z
  .object({
    id: z.string(),
    title: z.string(),
    variantTitle: z.string().nullable(),
    variantOptionValues: z.string().nullable(),
    thumbnail: z.string().nullable(),
    quantity: z.number(),
    unitPrice: bigNumberToString,
    lineTotal: bigNumberToString,
  })
  .openapi('StoreOrderLineItem')
export type StoreOrderLineItem = z.input<typeof StoreOrderLineItem>

export const StoreOrderShippingMethod = z
  .object({
    name: z.string(),
    amount: bigNumberToString,
  })
  .openapi('StoreOrderShippingMethod')
export type StoreOrderShippingMethod = z.input<typeof StoreOrderShippingMethod>

export const StoreOrderAddress = z
  .object({
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
  .openapi('StoreOrderAddress')
export type StoreOrderAddress = z.input<typeof StoreOrderAddress>

export const StoreOrderTotals = z
  .object({
    itemsTotal: bigNumberToString,
    shippingTotal: bigNumberToString,
    orderTotal: bigNumberToString,
  })
  .openapi('StoreOrderTotals')
export type StoreOrderTotals = z.input<typeof StoreOrderTotals>

export const StoreOrder = z
  .object({
    id: z.string(),
    displayId: z.number(),
    status: StoreOrderStatus,
    fulfillmentStatus: StoreOrderFulfillmentStatus,
    email: z.string(),
    currencyCode: z.string(),
    createdAt: dateToIso,
    ...timestamps.pick({ updatedAt: true }).shape,
  })
  .openapi('StoreOrder')
export type StoreOrder = z.input<typeof StoreOrder>
