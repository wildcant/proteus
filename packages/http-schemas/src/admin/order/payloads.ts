import { z } from 'zod'
import {
  countryCode,
  entityId,
  httpUrl,
  MAX_ITEMS,
  machineCode,
  phone,
  postalCode,
  shortText,
  textBlob,
} from '../../bounded.js'
import { amountToBigNumber } from '../../common.js'

export const AdminCreateFulfillmentItem = z.object({
  title: shortText.min(1),
  quantity: z.number().int().min(1),
  sku: machineCode.optional(),
  barcode: machineCode.optional(),
  // Required, unlike the fulfillment module's own item shape: a fulfillment created *for an order*
  // has to cover every one of its line items, and an item that names none cannot be counted towards
  // that. See `create-order-fulfillment`.
  lineItemId: entityId,
  inventoryItemId: entityId.optional(),
})

export const AdminCreateFulfillmentAddress = z.object({
  company: shortText.optional(),
  firstName: shortText.optional(),
  lastName: shortText.optional(),
  address1: shortText.optional(),
  address2: shortText.optional(),
  city: shortText.optional(),
  countryCode: countryCode.optional(),
  province: shortText.optional(),
  postalCode: postalCode.optional(),
  phone: phone.optional(),
})

export const AdminCreateOrderFulfillment = z
  .object({
    providerId: entityId.min(1),
    // Optional: omitted, the server ships from the location the order's stock is reserved at, which
    // is the only one that can hold it. Naming a different one is refused rather than recorded.
    locationId: entityId.optional(),
    items: z.array(AdminCreateFulfillmentItem).min(1).max(MAX_ITEMS.batch),
    address: AdminCreateFulfillmentAddress,
    shippingOptionId: entityId.optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    // Free-form and never parsed here, so it gets the blob ceiling rather than a label's.
    metadata: textBlob.optional(),
  })
  .openapi('AdminCreateOrderFulfillment')
export type AdminCreateOrderFulfillmentBody = z.infer<typeof AdminCreateOrderFulfillment>

export const AdminCreateOrderShipment = z
  .object({
    trackingNumber: machineCode.optional(),
    trackingUrl: httpUrl.optional(),
    labelUrl: httpUrl.optional(),
  })
  .openapi('AdminCreateOrderShipment')
export type AdminCreateOrderShipmentBody = z.infer<typeof AdminCreateOrderShipment>

/** A payment received outside Proteus — a transfer, cash on delivery — recorded on the Order. */
export const AdminRecordOrderPayment = z
  .object({
    amount: amountToBigNumber,
  })
  .openapi('AdminRecordOrderPayment')
export type AdminRecordOrderPaymentBody = z.infer<typeof AdminRecordOrderPayment>

export const AdminCancelOrder = z
  .object({
    /**
     * How much of what the Order has received to return, from nothing to all of it. Omitted, all
     * of it is refunded.
     */
    refundAmount: amountToBigNumber.optional(),
  })
  // A cancel with nothing to say about refunds sends no body at all.
  .default({})
  .openapi('AdminCancelOrder')
export type AdminCancelOrderBody = z.infer<typeof AdminCancelOrder>
