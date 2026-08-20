import type { CustomerDTO } from '@core/types/customer/common.js'
import type { CreateCustomerDTO } from '@core/types/customer/mutations.js'
import type { ICustomerModuleService } from '@core/types/customer/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'
import { setAuthAppMetadataStep } from '../auth/steps/set-auth-app-metadata.js'

export type CreateCustomerAccountInput = {
  authIdentityId: string
  customerData: CreateCustomerDTO
}

export const createCustomerAccountWorkflow = createWorkflow<CreateCustomerAccountInput, CustomerDTO>(
  'create-customer-account',
  async (ctx, input) => {
    const customer = await ctx.step<CustomerDTO>(
      'create-customer',
      async ({ container }) => {
        const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
        return customerService.createCustomer({ ...input.customerData, hasAccount: true })
      },
      async (createdCustomer, { container }) => {
        const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)
        await customerService.softDeleteCustomers([createdCustomer.id])
      },
    )

    await setAuthAppMetadataStep(ctx, {
      authIdentityId: input.authIdentityId,
      actorType: 'customer',
      actorId: customer.id,
    })

    return customer
  },
)
