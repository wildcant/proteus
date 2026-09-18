import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { orderAddressTable } from './models/address.js'
import { orderLineItemTable } from './models/line-item.js'
import { orderTable } from './models/order.js'
import { orderShippingMethodTable } from './models/shipping-method.js'
import { orderTransactionTable } from './models/transaction.js'
import { OrderRepository } from './repositories/order.js'
import { OrderAddressRepository } from './repositories/order-address.js'
import { OrderLineItemRepository } from './repositories/order-line-item.js'
import { OrderShippingMethodRepository } from './repositories/order-shipping-method.js'
import { OrderTransactionRepository } from './repositories/order-transaction.js'
import { OrderModuleService } from './services/order-module-service.js'

export default Module(Modules.ORDER, {
  service: OrderModuleService,
  features: [
    { id: 'order.read', title: 'View orders' },
    { id: 'order.complete', title: 'Complete orders' },
    { id: 'order.cancel', title: 'Cancel orders' },
    { id: 'order.archive', title: 'Archive orders' },
    { id: 'order.fulfill', title: 'Fulfill orders' },
    { id: 'order.ship', title: 'Ship orders' },
    { id: 'order.deliver', title: 'Deliver orders' },
  ],
  models: {
    orderAddressTable,
    orderLineItemTable,
    orderShippingMethodTable,
    orderTable,
    orderTransactionTable,
  },
  repositories: {
    orderRepository: OrderRepository,
    orderAddressRepository: OrderAddressRepository,
    orderLineItemRepository: OrderLineItemRepository,
    orderShippingMethodRepository: OrderShippingMethodRepository,
    orderTransactionRepository: OrderTransactionRepository,
  },
})
