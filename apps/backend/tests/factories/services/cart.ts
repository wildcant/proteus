import type { AwilixContainer } from 'awilix'
import type { FilterableCartLineItemProps, FilterableCartProps } from '../../../src/core/types/cart/common.js'
import type {
  CreateCartDTO,
  CreateLineItemDTO,
  CreateShippingMethodDTO,
  UpdateCartDTO,
  UpdateCartWithAddressesDTO,
} from '../../../src/core/types/cart/mutations.js'
import type { ICartModuleService } from '../../../src/core/types/cart/service.js'
import { Modules } from '../../../src/core/utils/index.js'
import {
  generateCreateCartDTO,
  generateCreateLineItemDTO,
  generateCreateShippingMethodDTO,
  generateUpdateCartDTO,
  generateUpdateCartWithAddressesDTO,
} from '../cart-dto.js'

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

/** Attaches addresses to a cart, the way `update-cart` does mid-checkout. */
export async function addCartAddresses(
  container: AwilixContainer,
  cartId: string,
  overrides?: Partial<UpdateCartWithAddressesDTO>,
) {
  const cartService = container.resolve<ICartModuleService>(Modules.CART)

  return cartService.updateCartWithAddresses(cartId, generateUpdateCartWithAddressesDTO(overrides))
}

// ---- Update ----

/** Direct write, for cart states no store route produces on demand — a completed cart. */
export async function updateCart(container: AwilixContainer, cartId: string, overrides?: Partial<UpdateCartDTO>) {
  const cartService = container.resolve<ICartModuleService>(Modules.CART)

  return cartService.updateCart(cartId, generateUpdateCartDTO(overrides))
}

// ---- Reads ----

export async function retrieveCart(container: AwilixContainer, cartId: string) {
  const cartService = container.resolve<ICartModuleService>(Modules.CART)

  return cartService.retrieveCart(cartId)
}

export async function listCarts(container: AwilixContainer, filters?: FilterableCartProps) {
  const cartService = container.resolve<ICartModuleService>(Modules.CART)

  return cartService.listCarts(filters)
}

export async function listLineItems(container: AwilixContainer, filters?: FilterableCartLineItemProps) {
  const cartService = container.resolve<ICartModuleService>(Modules.CART)

  return cartService.listLineItems(filters)
}

export async function retrieveCartAddress(container: AwilixContainer, addressId: string) {
  const cartService = container.resolve<ICartModuleService>(Modules.CART)

  return cartService.retrieveCartAddress(addressId)
}
