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

export const AdminCreateFulfillmentItem = z.object({
  title: shortText.min(1),
  quantity: z.number().int().min(1),
  sku: machineCode.optional(),
  barcode: machineCode.optional(),
  lineItemId: entityId.optional(),
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
    locationId: entityId.min(1),
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
