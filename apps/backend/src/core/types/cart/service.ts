import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  CartAddressDTO,
  CartDTO,
  CartLineItemDTO,
  CartShippingMethodDTO,
  FilterableCartLineItemProps,
  FilterableCartProps,
  FilterableCartShippingMethodProps,
} from './common.js'
import type {
  CreateCartDTO,
  CreateLineItemDTO,
  CreateShippingMethodDTO,
  UpdateCartDTO,
  UpdateLineItemDTO,
} from './mutations.js'

export type ICartModuleService = {
  retrieveCart(cartId: string, config?: FindConfig<CartDTO>, context?: Context): Promise<CartDTO>
  retrieveCartAddress(addressId: string, context?: Context): Promise<CartAddressDTO>
  listCarts(filters?: FilterableCartProps, config?: FindConfig<CartDTO>, context?: Context): Promise<CartDTO[]>
  listAndCountCarts(
    filters?: FilterableCartProps,
    config?: FindConfig<CartDTO>,
    context?: Context,
  ): Promise<[CartDTO[], number]>
  createCarts(data: CreateCartDTO[], context?: Context): Promise<CartDTO[]>
  updateCarts(cartIds: string[], data: UpdateCartDTO, context?: Context): Promise<CartDTO[]>
  createCart(data: CreateCartDTO, context?: Context): Promise<CartDTO>
  updateCart(cartId: string, data: UpdateCartDTO, context?: Context): Promise<CartDTO>
  deleteCarts(cartIds: string[], context?: Context): Promise<void>
  softDeleteCarts(cartIds: string[], context?: Context): Promise<void>
  restoreCarts(cartIds: string[], context?: Context): Promise<void>
  completeCart(cartId: string, context?: Context): Promise<CartDTO>
  listLineItems(
    filters?: FilterableCartLineItemProps,
    config?: FindConfig<CartLineItemDTO>,
    context?: Context,
  ): Promise<CartLineItemDTO[]>
  addLineItems(cartId: string, items: CreateLineItemDTO[], context?: Context): Promise<CartLineItemDTO[]>
  updateLineItems(lineItemIds: string[], data: UpdateLineItemDTO, context?: Context): Promise<CartLineItemDTO[]>
  addLineItem(cartId: string, item: CreateLineItemDTO, context?: Context): Promise<CartLineItemDTO>
  updateLineItem(lineItemId: string, data: UpdateLineItemDTO, context?: Context): Promise<CartLineItemDTO>
  deleteLineItems(lineItemIds: string[], context?: Context): Promise<void>
  listShippingMethods(
    filters?: FilterableCartShippingMethodProps,
    config?: FindConfig<CartShippingMethodDTO>,
    context?: Context,
  ): Promise<CartShippingMethodDTO[]>
  addShippingMethods(
    cartId: string,
    methods: CreateShippingMethodDTO[],
    context?: Context,
  ): Promise<CartShippingMethodDTO[]>
  deleteShippingMethods(shippingMethodIds: string[], context?: Context): Promise<void>
}
