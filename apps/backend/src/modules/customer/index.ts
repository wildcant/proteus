import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { customerTable } from './models/customer.js'
import { customerAddressTable } from './models/customer-address.js'
import { CustomerRepository } from './repositories/customer.js'
import { CustomerAddressRepository } from './repositories/customer-address.js'
import { CustomerModuleService } from './services/customer-module-service.js'

export default Module(Modules.CUSTOMER, {
  service: CustomerModuleService,
  models: {
    customerAddressTable,
    customerTable,
  },
  repositories: {
    customerRepository: CustomerRepository,
    customerAddressRepository: CustomerAddressRepository,
  },
})
