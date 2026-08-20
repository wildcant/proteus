import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { CartRepository } from './repositories/cart.js'
import { CartAddressRepository } from './repositories/cart-address.js'
import { CartLineItemRepository } from './repositories/cart-line-item.js'
import { CartShippingMethodRepository } from './repositories/cart-shipping-method.js'
import { CartModuleService } from './services/cart-module-service.js'

export default Module(Modules.CART, {
  service: CartModuleService,
  repositories: {
    cartRepository: CartRepository,
    cartAddressRepository: CartAddressRepository,
    cartLineItemRepository: CartLineItemRepository,
    cartShippingMethodRepository: CartShippingMethodRepository,
  },
})
