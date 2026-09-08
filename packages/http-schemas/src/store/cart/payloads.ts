import { z } from 'zod'
import { countryCode, entityId, MAX_ITEMS, phone, postalCode, shortText } from '../../bounded.js'

/**
 * What a shopper picks. Nothing else: the title, the option values and above all the price are
 * read off the catalogue when the line item is written, so a payload cannot name the terms of
 * its own sale.
 */
export const AddLineItem = z.object({
  variantId: entityId.min(1),
  quantity: z.number().int().positive(),
})
export type AddLineItemBody = z.infer<typeof AddLineItem>

export const CreateCart = z.object({
  email: z.email().optional(),
  items: z.array(AddLineItem).max(MAX_ITEMS.batch).optional(),
})
export type CreateCartBody = z.infer<typeof CreateCart>

export const CartAddressInput = z.object({
  firstName: shortText.nullable(),
  lastName: shortText.nullable(),
  address1: shortText.min(1, 'Address is required'),
  address2: shortText.optional().nullable(),
  company: shortText.optional().nullable(),
  city: shortText.min(1, 'City is required'),
  countryCode: countryCode.length(2, 'Country is required'),
  province: shortText.optional().nullable(),
  postalCode: postalCode.min(1, 'Postal code is required'),
  phone: phone.optional().nullable(),
})
export type CartAddressInputBody = z.infer<typeof CartAddressInput>

export const UpdateCart = z.object({
  /**
   * The market the shopper is switching to, named by the one thing the storefront holds: the
   * country segment in its own URL. The region and the currency behind it are resolved server-side,
   * the same way `POST /store/carts` already resolves them at creation — so market logic lives in
   * one place and a storefront never has to learn what a region is.
   */
  countryCode: z.string().length(2).optional(),
  /**
   * The same switch, named by region id. Kept because it is the workflow's own contract and what
   * a server-side caller already holds; `countryCode` is resolved to one of these before anything
   * is written. Naming both is not an error — the region id is the more specific answer and wins.
   *
   * Either way the currency is the region's to decide and never the payload's: a caller free to
   * name its own would be naming the money the shopper is charged in.
   */
  regionId: entityId.min(1).optional(),
  email: z.email().optional(),
  firstName: shortText.optional(),
  lastName: shortText.optional(),
  shippingAddress: CartAddressInput.optional(),
  billingAddress: CartAddressInput.optional(),
})
export type UpdateCartBody = z.infer<typeof UpdateCart>

export const UpdateLineItem = z.object({
  quantity: z.number().int().positive().optional(),
})
export type UpdateLineItemBody = z.infer<typeof UpdateLineItem>

export const LineIdParams = z.object({
  id: entityId.min(1),
  lineId: entityId.min(1),
})
export type LineIdParams = z.infer<typeof LineIdParams>
