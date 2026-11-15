import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  ComputeOrderTotalsDTO,
  DraftOrderDetailDTO,
  EnrichedOrderLineItemDTO,
  FilterableOrderAddressProps,
  FilterableOrderLineItemProps,
  FilterableOrderProps,
  FilterableOrderShippingMethodProps,
  FilterableOrderTransactionProps,
  OrderAddressDTO,
  OrderAddressType,
  OrderDTO,
  OrderLineItemDTO,
  OrderShippingMethodDTO,
  OrderTotals,
  OrderTransactionDTO,
} from './common.js'
import type {
  CreateOrderAddressDTO,
  CreateOrderDTO,
  CreateOrderLineItemDTO,
  CreateOrderShippingMethodDTO,
  CreateOrderTransactionDTO,
  DraftOrderLineItemsAddition,
  DraftOrderShippingMethodReplacement,
  OrderLineItemQuantityDTO,
  OrderShippingMethodRefreshDTO,
  UpdateDraftOrderDTO,
  UpdateOrderDTO,
} from './mutations.js'

export type IOrderModuleService = {
  // Orders
  retrieveOrder(id: string, config?: FindConfig<OrderDTO>, context?: Context): Promise<OrderDTO>
  listOrders(filters?: FilterableOrderProps, config?: FindConfig<OrderDTO>, context?: Context): Promise<OrderDTO[]>
  listAndCountOrders(
    filters?: FilterableOrderProps,
    config?: FindConfig<OrderDTO>,
    context?: Context,
  ): Promise<[OrderDTO[], number]>
  createOrder(data: CreateOrderDTO, context?: Context): Promise<OrderDTO>
  createOrders(data: CreateOrderDTO[], context?: Context): Promise<OrderDTO[]>
  updateOrder(id: string, data: UpdateOrderDTO, context?: Context): Promise<OrderDTO>
  updateOrders(ids: string[], data: UpdateOrderDTO, context?: Context): Promise<OrderDTO[]>
  /** The id of the Order with this display id whose shipping address phone ends in these digits,
   *  compared after stripping everything but numbers. One query, so a wrong number, wrong digits and
   *  an Order without a phone all answer the same `null`. */
  findOrderIdByDisplayIdAndPhoneDigits(
    displayId: number,
    phoneLastDigits: string,
    context?: Context,
  ): Promise<string | null>
  softDeleteOrders(ids: string[], context?: Context): Promise<void>
  restoreOrders(ids: string[], context?: Context): Promise<void>

  // Addresses — owned by the order, so reads and writes are scoped to a parent
  retrieveOrderAddress(orderId: string, type: OrderAddressType, context?: Context): Promise<OrderAddressDTO | null>
  listOrderAddresses(
    filters?: FilterableOrderAddressProps,
    config?: FindConfig<OrderAddressDTO>,
    context?: Context,
  ): Promise<OrderAddressDTO[]>
  createOrderAddress(
    orderId: string,
    type: OrderAddressType,
    data: CreateOrderAddressDTO,
    context?: Context,
  ): Promise<OrderAddressDTO>
  /** Rewrites the order's address of one type in place, or creates it when the order has none. */
  upsertOrderAddress(
    orderId: string,
    type: OrderAddressType,
    data: CreateOrderAddressDTO,
    context?: Context,
  ): Promise<OrderAddressDTO>
  softDeleteOrderAddresses(ids: string[], context?: Context): Promise<void>

  // Line items
  createOrderLineItems(orderId: string, items: CreateOrderLineItemDTO[], context?: Context): Promise<OrderLineItemDTO[]>
  listOrderLineItems(
    filters?: FilterableOrderLineItemProps,
    config?: FindConfig<OrderLineItemDTO>,
    context?: Context,
  ): Promise<OrderLineItemDTO[]>
  updateOrderLineItemQuantities(updates: OrderLineItemQuantityDTO[], context?: Context): Promise<void>
  softDeleteOrderLineItems(ids: string[], context?: Context): Promise<void>
  restoreOrderLineItems(ids: string[], context?: Context): Promise<void>

  // Shipping methods
  createOrderShippingMethods(
    orderId: string,
    methods: CreateOrderShippingMethodDTO[],
    context?: Context,
  ): Promise<OrderShippingMethodDTO[]>
  listOrderShippingMethods(
    filters?: FilterableOrderShippingMethodProps,
    config?: FindConfig<OrderShippingMethodDTO>,
    context?: Context,
  ): Promise<OrderShippingMethodDTO[]>
  softDeleteOrderShippingMethods(ids: string[], context?: Context): Promise<void>
  restoreOrderShippingMethods(ids: string[], context?: Context): Promise<void>
  applyOrderShippingMethodRefresh(data: OrderShippingMethodRefreshDTO, context?: Context): Promise<void>

  /** A Draft Order and what the shop confirms it by; NOT_FOUND for an Order that was never a draft. */
  retrieveDraftOrder(id: string, context?: Context): Promise<DraftOrderDetailDTO>
  // Draft orders — every mutation below refuses an Order that is not a draft still open for edits
  updateDraftOrder(id: string, data: UpdateDraftOrderDTO, context?: Context): Promise<OrderDTO>
  /** Adds priced lines, merging each into the line the draft already holds for its variant. */
  addDraftOrderLineItems(
    id: string,
    items: CreateOrderLineItemDTO[],
    context?: Context,
  ): Promise<DraftOrderLineItemsAddition>
  updateDraftOrderLineItem(
    id: string,
    lineItemId: string,
    quantity: number,
    context?: Context,
  ): Promise<OrderLineItemDTO>
  removeDraftOrderLineItem(id: string, lineItemId: string, context?: Context): Promise<void>
  /** Replaces the draft's shipping methods with this one. */
  setDraftOrderShippingMethod(
    id: string,
    method: CreateOrderShippingMethodDTO,
    context?: Context,
  ): Promise<DraftOrderShippingMethodReplacement>
  /** The draft becomes a `pending` Order and leaves the drafts. */
  convertDraftOrder(id: string, context?: Context): Promise<OrderDTO>
  /** Deletes a Draft Order, canceled or not; an Order that was never a draft is refused. */
  deleteDraftOrder(id: string, context?: Context): Promise<void>

  // Transactions
  /**
   * Idempotent per `(reference, referenceId)`: a transaction already recorded for the same capture
   * or refund is answered with rather than written again, so a retried step never doubles the
   * Order's Paid Total.
   */
  addOrderTransaction(data: CreateOrderTransactionDTO, context?: Context): Promise<OrderTransactionDTO>
  /** As `addOrderTransaction`, for several at once. */
  addOrderTransactions(data: CreateOrderTransactionDTO[], context?: Context): Promise<OrderTransactionDTO[]>
  softDeleteOrderTransactions(ids: string[], context?: Context): Promise<void>
  listOrderTransactions(
    filters?: FilterableOrderTransactionProps,
    config?: FindConfig<OrderTransactionDTO>,
    context?: Context,
  ): Promise<OrderTransactionDTO[]>

  // Lifecycle
  completeOrder(id: string, context?: Context): Promise<OrderDTO>
  cancelOrder(id: string, context?: Context): Promise<OrderDTO>
  archiveOrder(id: string, context?: Context): Promise<OrderDTO>

  // Computed
  enrichLineItems(lineItems: OrderLineItemDTO[]): EnrichedOrderLineItemDTO[]
  computeOrderTotals(data: ComputeOrderTotalsDTO): OrderTotals
}
