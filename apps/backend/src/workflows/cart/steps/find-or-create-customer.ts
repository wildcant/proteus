import type { CustomerDTO } from '@core/types/customer/common.js'
import type { ICustomerModuleService } from '@core/types/customer/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import { toPhoneDigits } from '@core/utils/phone-digits.js'
import type { WorkflowContext } from '@core/workflows/types.js'

export type FindOrCreateCustomerInput = {
  customerId?: string | null
  email?: string | null
  /** Matched by its digits, for a guest who gave no email. */
  phone?: string | null
  firstName?: string | null
  lastName?: string | null
}

/** What a guest's update overwrote, so compensation can put it back. */
type PreviousGuestDetails = Pick<CustomerDTO, 'firstName' | 'lastName' | 'email' | 'phone'>

export type FoundOrCreatedCustomer = {
  customer: CustomerDTO | null
  created: boolean
  previous: PreviousGuestDetails | null
}

const NOT_FOUND: FoundOrCreatedCustomer = { customer: null, created: false, previous: null }

/**
 * Registered customers own their identity — we must never create a duplicate guest
 * record for an email that already belongs to an account. This check prevents that
 * by catching registered customers before guest handling runs.
 */
async function findRegisteredCustomer(
  customerService: ICustomerModuleService,
  input: FindOrCreateCustomerInput,
): Promise<CustomerDTO | null> {
  if (input.customerId) {
    const customer = await customerService.retrieveCustomer(input.customerId)
    if (customer.hasAccount) return customer
  }

  if (!input.email) return null

  const [customer] = await customerService.listCustomers({ email: input.email, hasAccount: true })
  return customer ?? null
}

/** The guest the shopper already is: by email first, then by phone, digits compared. */
async function findGuest(
  customerService: ICustomerModuleService,
  email: string | null,
  phone: string | null,
): Promise<CustomerDTO | null> {
  if (email) {
    const [byEmail] = await customerService.listCustomers({ email, hasAccount: false })
    if (byEmail) return byEmail
  }
  if (!phone) return null
  const [byPhone] = await customerService.listCustomers({ phone, hasAccount: false })
  return byPhone ?? null
}

/**
 * Guest customers are ephemeral — one per email or phone, reused across carts and draft orders. A
 * returning guest's details are brought up to date in place: a corrected name, and the email or the
 * phone they hadn't given before. What changed is snapshotted so compensation can restore it.
 */
async function findOrCreateGuest(
  customerService: ICustomerModuleService,
  input: FindOrCreateCustomerInput & { email: string | null; phone: string | null },
): Promise<FoundOrCreatedCustomer> {
  const existingGuest = await findGuest(customerService, input.email, input.phone)

  if (existingGuest) {
    const update = {
      ...(input.firstName != null && input.firstName !== existingGuest.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName != null && input.lastName !== existingGuest.lastName ? { lastName: input.lastName } : {}),
      ...(input.email && !existingGuest.email ? { email: input.email } : {}),
      ...(input.phone && !existingGuest.phone ? { phone: input.phone } : {}),
    }
    if (Object.keys(update).length === 0) return { customer: existingGuest, created: false, previous: null }

    const { firstName, lastName, email, phone } = existingGuest
    const updated = await customerService.updateCustomer(existingGuest.id, update)
    return { customer: updated, created: false, previous: { firstName, lastName, email, phone } }
  }

  const guest = await customerService.createCustomer({
    email: input.email,
    phone: input.phone,
    hasAccount: false,
    firstName: input.firstName ?? undefined,
    lastName: input.lastName ?? undefined,
  })
  return { customer: guest, created: true, previous: null }
}

/**
 * Every cart needs a customer for the eventual order. This step bridges authenticated
 * and guest checkout: registered customers pass through untouched, while guests get a
 * lightweight customer record. Compensation is safe because registered customers are
 * never mutated — only guest creations and name updates are rolled back.
 */
export async function findOrCreateCustomerStep(
  ctx: WorkflowContext,
  input: FindOrCreateCustomerInput,
): Promise<FoundOrCreatedCustomer> {
  return ctx.step<FoundOrCreatedCustomer>(
    'find-or-create-customer',
    async ({ container }) => {
      const phone = toPhoneDigits(input.phone)
      if (!input.customerId && !input.email && !phone) return NOT_FOUND

      const customerService = container.resolve(Modules.CUSTOMER)

      const registered = await findRegisteredCustomer(customerService, input)
      if (registered) return { customer: registered, created: false, previous: null }

      if (!input.email && !phone) return NOT_FOUND

      return findOrCreateGuest(customerService, { ...input, email: input.email ?? null, phone })
    },
    async (result, { container }) => {
      if (!result.customer) return
      const customerService = container.resolve(Modules.CUSTOMER)

      if (result.created) {
        await customerService.softDeleteCustomers([result.customer.id])
      } else if (result.previous) {
        await customerService.updateCustomer(result.customer.id, result.previous)
      }
    },
  )
}
