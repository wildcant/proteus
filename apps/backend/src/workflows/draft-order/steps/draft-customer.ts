import { ErrorTypes } from '@core/errors/app-error.js'
import type { CustomerAddressDTO } from '@core/types/customer/common.js'
import type { OrderAddressDTO } from '@core/types/order/common.js'
import { Modules } from '@core/utils/modules-definition.js'
import { toPhoneDigits } from '@core/utils/phone-digits.js'
import type { WorkflowContext } from '@core/workflows/types.js'
import { WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import type { FindOrCreateCustomerInput, FoundOrCreatedCustomer } from '../../cart/steps/find-or-create-customer.js'

/** Who a draft is for, as the shop recorded it: its email and its shipping address, phone and name included. */
export type DraftContact = FindOrCreateCustomerInput & { shippingAddress: OrderAddressDTO | null }

export const readDraftContactThrows = [ErrorTypes.NOT_ALLOWED] as const

/**
 * The draft's contact, refused when the store needs one to convert and the draft has neither an email nor a phone:
 * a store that confirms orders in a chat records who the order is for before it holds stock for them.
 */
export async function readDraftContactStep(
  ctx: WorkflowContext,
  input: { orderId: string; requireContact?: boolean | undefined },
): Promise<DraftContact> {
  return ctx.step<DraftContact>('read-draft-contact', async ({ container }) => {
    const orderService = container.resolve(Modules.ORDER)
    const [order, shippingAddress] = await Promise.all([
      orderService.retrieveOrder(input.orderId),
      orderService.retrieveOrderAddress(input.orderId, 'shipping'),
    ])
    if (input.requireContact && !order.email && !shippingAddress?.phone) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.NOT_ALLOWED,
        code: 'draft_order_contact_required',
        message: i18n.t('Draft order "{orderId}" needs an email or a phone before it converts'),
        values: { orderId: input.orderId },
      })
    }

    return {
      customerId: order.customerId,
      email: order.email,
      phone: shippingAddress?.phone ?? null,
      firstName: shippingAddress?.firstName ?? null,
      lastName: shippingAddress?.lastName ?? null,
      shippingAddress,
    }
  })
}

/** The Order now belongs to the Customer its contact found or made; compensation puts the previous owner back. */
export async function linkOrderCustomerStep(
  ctx: WorkflowContext,
  input: { orderId: string; contact: DraftContact; found: FoundOrCreatedCustomer },
): Promise<void> {
  await ctx.step<string | null>(
    'link-order-customer',
    async ({ container }) => {
      const previous = input.contact.customerId ?? null
      const customerId = input.found.customer?.id
      if (!customerId || customerId === previous) return previous
      await container.resolve(Modules.ORDER).updateOrder(input.orderId, { customerId })
      return previous
    },
    async (previous, { container }) => {
      await container.resolve(Modules.ORDER).updateOrder(input.orderId, { customerId: previous })
    },
  )
}

const ADDRESS_FIELDS = ['company', 'address1', 'address2', 'city', 'province', 'postalCode', 'countryCode'] as const

const sameText = (a: string | null, b: string | null) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

/**
 * The same place as a saved address, whoever it is addressed to: the name on a parcel changes, the door doesn't.
 * The phone is compared by its digits, as the Customer's own is.
 */
const isSavedAlready = (address: OrderAddressDTO, saved: CustomerAddressDTO[]) =>
  saved.some(
    (candidate) =>
      ADDRESS_FIELDS.every((field) => sameText(candidate[field], address[field])) &&
      toPhoneDigits(candidate.phone) === toPhoneDigits(address.phone),
  )

/**
 * A Proteus departure from Medusa, which never copies an Order's address to its Customer: the address the shop
 * confirmed in the chat is saved on the Customer, so the next order starts from it. One the Customer already has
 * is not saved twice, and the first one becomes their default shipping address.
 */
export async function saveCustomerAddressStep(
  ctx: WorkflowContext,
  input: { contact: DraftContact; found: FoundOrCreatedCustomer },
): Promise<void> {
  await ctx.step<string | null>(
    'save-customer-address',
    async ({ container }) => {
      const customerId = input.found.customer?.id
      const address = input.contact.shippingAddress
      if (!customerId || !address) return null

      const customerService = container.resolve(Modules.CUSTOMER)
      const saved = await customerService.listCustomerAddresses({ customerId })
      if (isSavedAlready(address, saved)) return null

      const { company, firstName, lastName, address1, address2, city, countryCode, province, postalCode, phone } =
        address
      const created = await customerService.createCustomerAddress(
        {
          customerId,
          company,
          firstName,
          lastName,
          address1,
          address2,
          city,
          countryCode,
          province,
          postalCode,
          phone,
        },
        { makeDefault: !saved.some((candidate) => candidate.isDefaultShipping) },
      )
      return created.id
    },
    async (createdId, { container }) => {
      if (createdId) await container.resolve(Modules.CUSTOMER).softDeleteCustomerAddresses([createdId])
    },
  )
}
