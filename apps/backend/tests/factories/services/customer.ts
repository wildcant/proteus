import type { AwilixContainer } from 'awilix'
import type { FilterableCustomerProps } from '../../../src/core/types/customer/common.js'
import type { CreateCustomerDTO } from '../../../src/core/types/customer/mutations.js'
import type { ICustomerModuleService } from '../../../src/core/types/customer/service.js'
import { Modules } from '../../../src/core/utils/index.js'
import { generateCreateCustomerDTO } from '../customer-dto.js'

export async function createCustomer(container: AwilixContainer, overrides?: Partial<CreateCustomerDTO>) {
  const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)

  return customerService.createCustomer(generateCreateCustomerDTO(overrides))
}

// ---- Reads ----

export async function retrieveCustomer(container: AwilixContainer, customerId: string) {
  const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)

  return customerService.retrieveCustomer(customerId)
}

export async function listCustomers(container: AwilixContainer, filters?: FilterableCustomerProps) {
  const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)

  return customerService.listCustomers(filters)
}
