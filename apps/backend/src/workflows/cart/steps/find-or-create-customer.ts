import type { CustomerDTO } from '@core/types/customer/common.js'
import type { ICustomerModuleService } from '@core/types/customer/service.js'
import { Modules } from '@core/utils/index.js'
import type { WorkflowContext } from '@core/workflows/types.js'

export type FindOrCreateCustomerInput = {
  customerId?: string | null
  email?: string
  firstName?: string | null
  lastName?: string | null
}

export type FindOrCreateCustomerResult = {
  customer: CustomerDTO | null
  created: boolean
  previousName: { firstName: string | null; lastName: string | null } | null
}

const NOT_FOUND: FindOrCreateCustomerResult = { customer: null, created: false, previousName: null }

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

/**
 * Guest customers are ephemeral — one per email, reused across carts. If a returning
 * guest corrects their name (e.g. typo fix between checkout attempts), we update in place
 * and snapshot the old name so compensation can restore it if the workflow fails.
 */
async function findOrCreateGuest(
  customerService: ICustomerModuleService,
  input: FindOrCreateCustomerInput & { email: string },
): Promise<FindOrCreateCustomerResult> {
  const [existingGuest] = await customerService.listCustomers({ email: input.email, hasAccount: false })

  if (existingGuest) {
    const nameChanged =
      (input.firstName !== undefined && input.firstName !== existingGuest.firstName) ||
      (input.lastName !== undefined && input.lastName !== existingGuest.lastName)

    if (!nameChanged) return { customer: existingGuest, created: false, previousName: null }

    const previousName = { firstName: existingGuest.firstName, lastName: existingGuest.lastName }
    const updated = await customerService.updateCustomer(existingGuest.id, {
      ...(input.firstName != null ? { firstName: input.firstName } : {}),
      ...(input.lastName != null ? { lastName: input.lastName } : {}),
    })
    return { customer: updated, created: false, previousName }
  }

  const guest = await customerService.createCustomer({
    email: input.email,
    hasAccount: false,
    firstName: input.firstName ?? undefined,
    lastName: input.lastName ?? undefined,
  })
  return { customer: guest, created: true, previousName: null }
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
): Promise<FindOrCreateCustomerResult> {
  return ctx.step<FindOrCreateCustomerResult>(
    'find-or-create-customer',
    async ({ container }) => {
      if (!input.customerId && !input.email) return NOT_FOUND

      const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)

      const registered = await findRegisteredCustomer(customerService, input)
      if (registered) return { customer: registered, created: false, previousName: null }

      if (!input.email) return NOT_FOUND

      return findOrCreateGuest(customerService, { ...input, email: input.email })
    },
    async (result, { container }) => {
      if (!result.customer) return
      const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)

      if (result.created) {
        await customerService.deleteCustomers([result.customer.id])
      } else if (result.previousName) {
        await customerService.updateCustomer(result.customer.id, result.previousName)
      }
    },
  )
}
