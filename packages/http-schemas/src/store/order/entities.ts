import { z } from 'zod'
import { bigNumberToString, dateToIso, timestamps } from '../../common.js'

export const StoreOrderStatus = z.enum(['draft', 'pending', 'completed', 'canceled', 'archived'])

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

/** One entry of the line's Option Combination, as it stood when the Order was placed. */
export const StoreOrderLineItemOption = z
  .object({
    optionTitle: z.string(),
    /** How the product draws this option: a `swatch` value reads alone, a `text` one beside its title. */
    renderAs: z.enum(['text', 'swatch']),
    value: z.string(),
  })
  .openapi('StoreOrderLineItemOption')
export type StoreOrderLineItemOption = z.input<typeof StoreOrderLineItemOption>

export const StoreOrderLineItem = z
  .object({
    id: z.string(),
    title: z.string(),
    variantTitle: z.string().nullable(),
    variantOptionValues: z.string().nullable(),
    variantOptions: z.array(StoreOrderLineItemOption),
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

/** Where the Order goes, only as far as the city: anyone holding the Order's link reads this. */
export const StoreOrderLocality = z
  .object({
    city: z.string().nullable(),
    province: z.string().nullable(),
  })
  .openapi('StoreOrderLocality')
export type StoreOrderLocality = z.input<typeof StoreOrderLocality>

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

/** What only the signed-in customer who placed the Order reads: where it went in full, and the email. */
export const StoreOrderOwnerDetails = z
  .object({
    email: z.string().nullable(),
    shippingAddress: StoreOrderAddress.nullable(),
  })
  .openapi('StoreOrderOwnerDetails')
export type StoreOrderOwnerDetails = z.input<typeof StoreOrderOwnerDetails>

export const StoreOrderTotals = z
  .object({
    itemsTotal: bigNumberToString,
    shippingTotal: bigNumberToString,
    orderTotal: bigNumberToString,
    /** The sum of the Order's transactions: what the shop has received, less what it refunded. */
    paidTotal: bigNumberToString,
    /** The order total less the paid total. */
    outstandingTotal: bigNumberToString,
  })
  .openapi('StoreOrderTotals')
export type StoreOrderTotals = z.input<typeof StoreOrderTotals>

export const StoreOrder = z
  .object({
    id: z.string(),
    displayId: z.number(),
    /** The store's reference prefix followed by the display id, or the bare display id. */
    reference: z.string(),
    status: StoreOrderStatus,
    fulfillmentStatus: StoreOrderFulfillmentStatus,
    email: z.string().nullable(),
    currencyCode: z.string(),
    createdAt: dateToIso,
    ...timestamps.pick({ updatedAt: true }).shape,
  })
  .openapi('StoreOrder')
export type StoreOrder = z.input<typeof StoreOrder>

/**
 * An Order as anyone holding its id reads it, a shopper's shared link included. An allowlist, so a
 * field added to the Order stays private until it is named here: no email, no street, no phone,
 * except in `owner`, for the customer who placed it.
 */
export const StoreOrderDetail = z
  .object({
    id: z.string(),
    displayId: z.number(),
    reference: z.string(),
    /** Whether the shop has confirmed the Order, separately from its payments and its delivery. */
    status: StoreOrderStatus,
    paymentStatus: z.enum(['awaiting', 'authorized', 'captured']),
    fulfillmentStatus: StoreOrderFulfillmentStatus,
    currencyCode: z.string(),
    createdAt: dateToIso,
    canceledAt: dateToIso.nullable(),
    lineItems: z.array(StoreOrderLineItem),
    shippingAddress: StoreOrderLocality.nullable(),
    shippingMethods: z.array(StoreOrderShippingMethod),
    totals: StoreOrderTotals,
    /** Absent unless the reader is the signed-in customer the Order belongs to. */
    owner: StoreOrderOwnerDetails.optional(),
  })
  .openapi('StoreOrderDetail')
export type StoreOrderDetail = z.input<typeof StoreOrderDetail>
