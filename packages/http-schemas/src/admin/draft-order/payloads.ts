import { i18n } from '@proteus/utils'
import { z } from 'zod'
import { countryCode, decimalAmount, entityId, MAX_ITEMS, phone, postalCode, shortText } from '../../bounded.js'
import { amountToBigNumber } from '../../common.js'

/** What the shop records on a draft's shipping address once agreed with the shopper; merged into what is there. */
export const AdminDraftOrderAddress = z.object({
  company: shortText.nullable().optional(),
  firstName: shortText.nullable().optional(),
  lastName: shortText.nullable().optional(),
  address1: shortText.nullable().optional(),
  address2: shortText.nullable().optional(),
  city: shortText.nullable().optional(),
  countryCode: countryCode.nullable().optional(),
  province: shortText.nullable().optional(),
  postalCode: postalCode.nullable().optional(),
  phone: phone.nullable().optional(),
})

export const AdminUpdateDraftOrder = z
  .object({
    email: z.email(i18n.t('Enter a valid email address')).nullable().optional(),
    shippingAddress: AdminDraftOrderAddress.optional(),
  })
  .openapi('AdminUpdateDraftOrder')
export type AdminUpdateDraftOrderBody = z.infer<typeof AdminUpdateDraftOrder>

export const AdminAddDraftOrderItems = z
  .object({
    items: z
      .array(z.object({ variantId: entityId.min(1), quantity: z.number().int().min(1) }))
      .min(1)
      .max(MAX_ITEMS.batch),
  })
  .openapi('AdminAddDraftOrderItems')
export type AdminAddDraftOrderItemsBody = z.infer<typeof AdminAddDraftOrderItems>

export const AdminUpdateDraftOrderItem = z
  .object({ quantity: z.number().int().min(1) })
  .openapi('AdminUpdateDraftOrderItem')
export type AdminUpdateDraftOrderItemBody = z.infer<typeof AdminUpdateDraftOrderItem>

export const AdminSetDraftOrderShippingMethod = z
  .object({
    shippingOptionId: entityId.min(1),
    /**
     * What the shop agreed with the shopper, in the draft's currency. Given, re-pricing never overrides
     * it; omitted, the option prices the draft as it would a Cart.
     */
    customAmount: decimalAmount.optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('AdminSetDraftOrderShippingMethod')
export type AdminSetDraftOrderShippingMethodBody = z.infer<typeof AdminSetDraftOrderShippingMethod>

export const AdminConvertDraftOrder = z
  .object({
    /** The deposit received, recorded as the Order's first payment. Omitted, the draft converts unpaid. */
    paymentAmount: amountToBigNumber.optional(),
  })
  // Converting without a payment sends no body at all.
  .default({})
  .openapi('AdminConvertDraftOrder')
export type AdminConvertDraftOrderBody = z.infer<typeof AdminConvertDraftOrder>
