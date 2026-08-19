import { z } from 'zod'

export const AdminCreateFulfillmentItem = z.object({
  title: z.string().min(1),
  quantity: z.number().int().min(1),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  lineItemId: z.string().optional(),
  inventoryItemId: z.string().optional(),
})

export const AdminCreateFulfillmentAddress = z.object({
  company: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  countryCode: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
})

export const AdminCreateOrderFulfillment = z
  .object({
    providerId: z.string().min(1),
    locationId: z.string().min(1),
    items: z.array(AdminCreateFulfillmentItem).min(1),
    address: AdminCreateFulfillmentAddress,
    shippingOptionId: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    metadata: z.string().optional(),
  })
  .openapi('AdminCreateOrderFulfillment')
export type AdminCreateOrderFulfillmentBody = z.infer<typeof AdminCreateOrderFulfillment>

export const AdminCreateOrderShipment = z
  .object({
    trackingNumber: z.string().optional(),
    trackingUrl: z.string().optional(),
    labelUrl: z.string().optional(),
  })
  .openapi('AdminCreateOrderShipment')
export type AdminCreateOrderShipmentBody = z.infer<typeof AdminCreateOrderShipment>
