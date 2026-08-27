import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  CartAddressDTO,
  CartAddressType,
  CartDTO,
  CartLineItemDTO,
  CartShippingMethodDTO,
  CartTotalsDTO,
  ComputeCartTotalsDTO,
  EnrichedCartLineItemDTO,
  FilterableCartAddressProps,
  FilterableCartLineItemProps,
  FilterableCartProps,
  FilterableCartShippingMethodProps,
} from './common.js'
import type {
  CartLineItemPlanDTO,
  CreateCartAddressDTO,
  CreateCartDTO,
  CreateLineItemDTO,
  CreateShippingMethodDTO,
  UpdateCartDTO,
  UpdateCartWithAddressesDTO,
  UpdateLineItemDTO,
} from './mutations.js'

export type ICartModuleService = {
  retrieveCart(cartId: string, config?: FindConfig<CartDTO>, context?: Context): Promise<CartDTO>
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
  updateCartWithAddresses(cartId: string, data: UpdateCartWithAddressesDTO, context?: Context): Promise<CartDTO>
  softDeleteCarts(cartIds: string[], context?: Context): Promise<void>
  restoreCarts(cartIds: string[], context?: Context): Promise<void>
  listLineItems(
    filters?: FilterableCartLineItemProps,
    config?: FindConfig<CartLineItemDTO>,
    context?: Context,
  ): Promise<CartLineItemDTO[]>
  addLineItems(cartId: string, items: CreateLineItemDTO[], context?: Context): Promise<CartLineItemDTO[]>
  updateLineItems(lineItemIds: string[], data: UpdateLineItemDTO, context?: Context): Promise<CartLineItemDTO[]>
  /**
   * Writes an addition: the lines it starts and the lines it raises, in one transaction. Both
   * halves are rows of the same table, so the database keeps them together — the caller needs no
   * compensation to undo a half-applied addition, and gets none.
   */
  applyLineItemPlan(cartId: string, plan: CartLineItemPlanDTO, context?: Context): Promise<CartLineItemDTO[]>
  addLineItem(cartId: string, item: CreateLineItemDTO, context?: Context): Promise<CartLineItemDTO>
  updateLineItem(lineItemId: string, data: UpdateLineItemDTO, context?: Context): Promise<CartLineItemDTO>
  softDeleteLineItems(lineItemIds: string[], context?: Context): Promise<void>
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
  softDeleteShippingMethods(shippingMethodIds: string[], context?: Context): Promise<void>

  // Addresses — owned by the cart, so reads and writes are scoped to a parent
  listCartAddresses(
    filters?: FilterableCartAddressProps,
    config?: FindConfig<CartAddressDTO>,
    context?: Context,
  ): Promise<CartAddressDTO[]>
  upsertCartAddress(
    cartId: string,
    type: CartAddressType,
    data: CreateCartAddressDTO,
    context?: Context,
  ): Promise<CartAddressDTO>
  softDeleteCartAddresses(addressIds: string[], context?: Context): Promise<void>

  // Computed
  enrichLineItem(lineItem: CartLineItemDTO): EnrichedCartLineItemDTO
  enrichLineItems(lineItems: CartLineItemDTO[]): EnrichedCartLineItemDTO[]
  computeCartTotals(data: ComputeCartTotalsDTO): CartTotalsDTO
}
