import { z } from 'zod'
import { bigNumberToString, dateToIso, nullableBigNumberToString, timestamps } from '../../common.js'
import { StoreVariantStock } from '../product/entities.js'

export const StoreCart = z
  .object({
    id: z.string(),
    regionId: z.string().nullable(),
    customerId: z.string().nullable(),
    salesChannelId: z.string().nullable(),
    email: z.string().nullable(),
    currencyCode: z.string(),
    completedAt: dateToIso.nullable(),
    ...timestamps.shape,
  })
  .openapi('StoreCart')
export type StoreCart = z.input<typeof StoreCart>

/** One entry of the line's Option Combination, as it stood when the line was added. */
export const StoreCartLineItemOption = z
  .object({
    optionTitle: z.string(),
    /** How the product draws this option: a `swatch` value reads alone («Negro y Crema»), a `text` one beside its title («Talla 41»). */
    renderAs: z.enum(['text', 'swatch']),
    value: z.string(),
  })
  .openapi('StoreCartLineItemOption')
export type StoreCartLineItemOption = z.input<typeof StoreCartLineItemOption>

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
    /** The product card's subline when the line was added («Tenis para hombre · Altos»); `null` for none. */
    productSubline: z.string().nullable(),
    productHandle: z.string().nullable(),
    variantSku: z.string().nullable(),
    variantBarcode: z.string().nullable(),
    variantTitle: z.string().nullable(),
    variantOptionValues: z.string().nullable(),
    /** The values of `variantOptionValues` beside their option's title, in the product's option order. */
    variantOptions: z.array(StoreCartLineItemOption),
    /**
     * The variant's stock as it stands now, not when the line was added. `soldOut` also answers for
     * a variant the catalogue no longer has: either way the line cannot be bought and must be removed.
     */
    stock: StoreVariantStock,
    /** The most this line may hold, for the quantity stepper to stop at; `null` when nothing caps it. */
    maxQuantity: z.number().int().nullable(),
    requiresShipping: z.boolean(),
    isDiscountable: z.boolean(),
    isGiftcard: z.boolean(),
    isTaxInclusive: z.boolean(),
    compareAtUnitPrice: nullableBigNumberToString,
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
    cartId: z.string(),
    type: z.enum(['shipping', 'billing']),
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
