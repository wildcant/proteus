import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { OrderRepository } from './repositories/order.js'
import { OrderAddressRepository } from './repositories/order-address.js'
import { OrderLineItemRepository } from './repositories/order-line-item.js'
import { OrderShippingMethodRepository } from './repositories/order-shipping-method.js'
import { OrderTransactionRepository } from './repositories/order-transaction.js'
import { OrderModuleService } from './services/order-module-service.js'

export default Module(Modules.ORDER, {
  service: OrderModuleService,
  repositories: {
    orderRepository: OrderRepository,
    orderAddressRepository: OrderAddressRepository,
    orderLineItemRepository: OrderLineItemRepository,
    orderShippingMethodRepository: OrderShippingMethodRepository,
    orderTransactionRepository: OrderTransactionRepository,
  },
})
