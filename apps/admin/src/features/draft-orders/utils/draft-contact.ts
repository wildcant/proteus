import { AdminDraftOrderAddress, AdminUpdateDraftOrder } from '@proteus/http-schemas/admin'
import { z } from 'zod'
import type {
  AdminDraftOrderResponseDraftOrder,
  AdminUpdateDraftOrder as AdminUpdateDraftOrderPayload,
  AdminUpdateDraftOrderShippingAddress,
} from '#/api/generated/model'

const ADDRESS_FIELDS = [
  'firstName',
  'lastName',
  'company',
  'phone',
  'address1',
  'address2',
  'city',
  'province',
  'postalCode',
  'countryCode',
] as const

type AddressField = (typeof ADDRESS_FIELDS)[number]

/** The contact drawer edits every field as text; an empty one means "not given". */
export type DraftContactValues = { email: string } & Record<AddressField, string>

/**
 * The route's own body schemas, flattened to the drawer's fields, with an empty email allowed: a
 * chat-only shopper has none, and the field starts empty for them.
 */
const address = AdminDraftOrderAddress.shape
export const draftContactSchema = z.object({
  email: z.union([z.literal(''), AdminUpdateDraftOrder.shape.email.unwrap().unwrap()]),
  // The drawer holds every field as text, so each is the bounded string beneath its `nullable().optional()`.
  firstName: address.firstName.unwrap().unwrap(),
  lastName: address.lastName.unwrap().unwrap(),
  company: address.company.unwrap().unwrap(),
  phone: address.phone.unwrap().unwrap(),
  address1: address.address1.unwrap().unwrap(),
  address2: address.address2.unwrap().unwrap(),
  city: address.city.unwrap().unwrap(),
  province: address.province.unwrap().unwrap(),
  postalCode: address.postalCode.unwrap().unwrap(),
  countryCode: address.countryCode.unwrap().unwrap(),
})

export function draftContactDefaults(
  draftOrder: Pick<AdminDraftOrderResponseDraftOrder, 'email' | 'shippingAddress'>,
): DraftContactValues {
  const address = draftOrder.shippingAddress
  return {
    email: draftOrder.email ?? '',
    firstName: address?.firstName ?? '',
    lastName: address?.lastName ?? '',
    company: address?.company ?? '',
    phone: address?.phone ?? '',
    address1: address?.address1 ?? '',
    address2: address?.address2 ?? '',
    city: address?.city ?? '',
    province: address?.province ?? '',
    postalCode: address?.postalCode ?? '',
    countryCode: address?.countryCode ?? '',
  }
}

/**
 * The update body: every field sent, trimmed, blank ones as `null`, so clearing a field clears it
 * on the draft (the server merges the address, so an omitted field would keep its old value).
 * Country codes are stored lowercase.
 */
export function draftContactPayload(values: DraftContactValues): AdminUpdateDraftOrderPayload {
  const blankToNull = (value: string) => value.trim() || null
  const shippingAddress: AdminUpdateDraftOrderShippingAddress = {}
  for (const field of ADDRESS_FIELDS) shippingAddress[field] = blankToNull(values[field])
  shippingAddress.countryCode = shippingAddress.countryCode?.toLowerCase() ?? null

  return { email: blankToNull(values.email), shippingAddress }
}
