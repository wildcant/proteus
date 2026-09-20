import type { AppContainer } from '../../../src/core/types/container.js'
import type {
  FilterableCustomerAddressProps,
  FilterableCustomerProps,
} from '../../../src/core/types/customer/common.js'
import type { CreateCustomerAddressDTO, CreateCustomerDTO } from '../../../src/core/types/customer/mutations.js'
import { Modules } from '../../../src/core/utils/modules-definition.js'
import { generateCreateCustomerAddressDTO, generateCreateCustomerDTO } from '../customer-dto.js'

export async function createCustomer(container: AppContainer, overrides?: Partial<CreateCustomerDTO>) {
  const customerService = container.resolve(Modules.CUSTOMER)

  return customerService.createCustomer(generateCreateCustomerDTO(overrides))
}

export async function createCustomerAddress(
  container: AppContainer,
  customerId: string,
  overrides?: Partial<Omit<CreateCustomerAddressDTO, 'customerId'>>,
) {
  const customerService = container.resolve(Modules.CUSTOMER)

  return customerService.createCustomerAddress({ ...generateCreateCustomerAddressDTO(overrides), customerId })
}

// ---- Reads ----

export async function listCustomerAddresses(container: AppContainer, filters?: FilterableCustomerAddressProps) {
  const customerService = container.resolve(Modules.CUSTOMER)

  return customerService.listCustomerAddresses(filters)
}

export async function retrieveCustomer(container: AppContainer, customerId: string) {
  const customerService = container.resolve(Modules.CUSTOMER)

  return customerService.retrieveCustomer(customerId)
}

export async function listCustomers(container: AppContainer, filters?: FilterableCustomerProps) {
  const customerService = container.resolve(Modules.CUSTOMER)

  return customerService.listCustomers(filters)
}
