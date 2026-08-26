import { z } from 'zod'
import { stringToBigNumber } from '../../common.js'

export const CreateCart = z.object({
  email: z.email().optional(),
  items: z
    .array(
      z.object({
        title: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: stringToBigNumber,
        variantId: z.string().optional(),
        productId: z.string().optional(),
        productTitle: z.string().optional(),
        variantSku: z.string().optional(),
      }),
    )
    .optional(),
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
  email: z.email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  shippingAddress: CartAddressInput.optional(),
  billingAddress: CartAddressInput.optional(),
})
export type UpdateCartBody = z.infer<typeof UpdateCart>

export const AddLineItem = z.object({
  title: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: stringToBigNumber,
  variantId: z.string().optional(),
  productId: z.string().optional(),
  productTitle: z.string().optional(),
  variantSku: z.string().optional(),
  /**
   * The chosen variant, carried from the PDP so the cart can name it back. Both columns
   * already exist on `cart_line_item` and both are already on `StoreCartLineItem`; this
   * payload was the only thing dropping them, which is why every line item written so far
   * has them null.
   */
  variantTitle: z.string().optional(),
  /** The option values joined for display, e.g. `Black · S · Slim Fit`. */
  variantOptionValues: z.string().optional(),
})
export type AddLineItemBody = z.infer<typeof AddLineItem>

export const UpdateLineItem = z.object({
  quantity: z.number().int().positive().optional(),
  unitPrice: stringToBigNumber.optional(),
})
export type UpdateLineItemBody = z.infer<typeof UpdateLineItem>

export const LineIdParams = z.object({
  id: z.string().min(1),
  lineId: z.string().min(1),
})
export type LineIdParams = z.infer<typeof LineIdParams>
