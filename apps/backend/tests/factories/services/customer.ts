import type { AwilixContainer } from 'awilix'
import type {
  FilterableCustomerAddressProps,
  FilterableCustomerProps,
} from '../../../src/core/types/customer/common.js'
import type { CreateCustomerAddressDTO, CreateCustomerDTO } from '../../../src/core/types/customer/mutations.js'
import type { ICustomerModuleService } from '../../../src/core/types/customer/service.js'
import { Modules } from '../../../src/core/utils/index.js'
import { generateCreateCustomerAddressDTO, generateCreateCustomerDTO } from '../customer-dto.js'

export async function createCustomer(container: AwilixContainer, overrides?: Partial<CreateCustomerDTO>) {
  const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)

  return customerService.createCustomer(generateCreateCustomerDTO(overrides))
}

export async function createCustomerAddress(
  container: AwilixContainer,
  customerId: string,
  overrides?: Partial<Omit<CreateCustomerAddressDTO, 'customerId'>>,
) {
  const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)

  return customerService.createCustomerAddress({ ...generateCreateCustomerAddressDTO(overrides), customerId })
}

// ---- Reads ----

export async function listCustomerAddresses(container: AwilixContainer, filters?: FilterableCustomerAddressProps) {
  const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)

  return customerService.listCustomerAddresses(filters)
}

export async function retrieveCustomer(container: AwilixContainer, customerId: string) {
  const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)

  return customerService.retrieveCustomer(customerId)
}

export async function listCustomers(container: AwilixContainer, filters?: FilterableCustomerProps) {
  const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER)

  return customerService.listCustomers(filters)
}
