import { z } from 'zod'

/**
 * What a shopper picks. Nothing else: the title, the option values and above all the price are
 * read off the catalogue when the line item is written, so a payload cannot name the terms of
 * its own sale.
 */
export const AddLineItem = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive(),
})
export type AddLineItemBody = z.infer<typeof AddLineItem>

export const CreateCart = z.object({
  email: z.email().optional(),
  items: z.array(AddLineItem).optional(),
})
export type CreateCartBody = z.infer<typeof CreateCart>

export const CartAddressInput = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  address1: z.string().min(1, 'Address is required'),
  address2: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  city: z.string().min(1, 'City is required'),
  countryCode: z.string().length(2, 'Country is required'),
  province: z.string().optional().nullable(),
  postalCode: z.string().min(1, 'Postal code is required'),
  phone: z.string().optional().nullable(),
})
export type CartAddressInputBody = z.infer<typeof CartAddressInput>

export const UpdateCart = z.object({
  /**
   * The market the shopper is switching to. Naming it reprices the whole cart into that region's
   * currency, so it is the region's id rather than a currency: the currency is the region's to
   * decide, and a payload free to name its own would be naming the money the shopper is charged in.
   */
  regionId: z.string().min(1).optional(),
  email: z.email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  shippingAddress: CartAddressInput.optional(),
  billingAddress: CartAddressInput.optional(),
})
export type UpdateCartBody = z.infer<typeof UpdateCart>

export const UpdateLineItem = z.object({
  quantity: z.number().int().positive().optional(),
})
export type UpdateLineItemBody = z.infer<typeof UpdateLineItem>

export const LineIdParams = z.object({
  id: z.string().min(1),
  lineId: z.string().min(1),
})
export type LineIdParams = z.infer<typeof LineIdParams>
