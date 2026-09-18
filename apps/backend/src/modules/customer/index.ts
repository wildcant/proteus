import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { customerTable } from './models/customer.js'
import { customerAddressTable } from './models/customer-address.js'
import { CustomerRepository } from './repositories/customer.js'
import { CustomerAddressRepository } from './repositories/customer-address.js'
import { CustomerModuleService } from './services/customer-module-service.js'

export default Module(Modules.CUSTOMER, {
  service: CustomerModuleService,
  features: [
    { id: 'customer.read', title: 'View customers' },
    { id: 'customer.create', title: 'Create customers' },
    { id: 'customer.update', title: 'Edit customers' },
    { id: 'customer.delete', title: 'Delete customers' },
  ],
  models: {
    customerAddressTable,
    customerTable,
  },
  repositories: {
    customerRepository: CustomerRepository,
    customerAddressRepository: CustomerAddressRepository,
  },
})
