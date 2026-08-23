import type { AwilixContainer } from 'awilix'
import type {
  CreateCartDTO,
  CreateLineItemDTO,
  CreateShippingMethodDTO,
} from '../../../src/core/types/cart/mutations.js'
import type { ICartModuleService } from '../../../src/core/types/cart/service.js'
import { Modules } from '../../../src/core/utils/index.js'
import { generateCreateCartDTO, generateCreateLineItemDTO, generateCreateShippingMethodDTO } from '../cart-dto.js'

export async function createCart(container: AwilixContainer, overrides?: Partial<CreateCartDTO>) {
  const cartService = container.resolve<ICartModuleService>(Modules.CART)

  return cartService.createCart(generateCreateCartDTO(overrides))
}

export async function addLineItem(container: AwilixContainer, cartId: string, overrides?: Partial<CreateLineItemDTO>) {
  const cartService = container.resolve<ICartModuleService>(Modules.CART)

  return cartService.addLineItem(cartId, generateCreateLineItemDTO(overrides))
}

export async function addShippingMethod(
  container: AwilixContainer,
  cartId: string,
  overrides?: Partial<CreateShippingMethodDTO>,
) {
  const cartService = container.resolve<ICartModuleService>(Modules.CART)

  const [shippingMethod] = await cartService.addShippingMethods(cartId, [generateCreateShippingMethodDTO(overrides)])

  if (!shippingMethod) throw new Error('addShippingMethods returned no rows')
  return shippingMethod
}
